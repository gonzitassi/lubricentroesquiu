const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const L = require('../assets/system.js');

const client = (id = 'c1', patent = 'AB123CD') => ({id,patent,name:'Cliente de prueba',whatsapp:'5493513880155',vehicleType:'auto',brand:'Ford',model:'Ka',year:'2020',motor:'1.6'});
const createCoordinatedStore = (db, defaults = [], options = {}) => L.createStore(db,defaults,{...options,coordinated:true});
const service = {id:'s1',name:'Cambio de aceite',price:'$10.000',duration:60,type:'auto'};
const date = '2099-01-05'; // Monday; intentionally independent of today's clock.
const appointment = (id = 'a1', time = '09:00', cid = 'c1') => ({id,clientId:cid,patent:'AB123CD',date,time,service:'s1',serviceName:service.name,pit:'auto',blockedSlots:L.slots(time,60,date),status:'pendiente',km:'10000',notes:''});

class FakeDB {
  constructor(v2 = true) {
    this.docs = new Map(); this.versions = new Map(); this.writes = []; this.offline = false; this.rejectCommit = false;
    this.set('lubricentro/schema',{data:{clientsV2:v2,appointmentsV2:v2}});
    this.set('lubricentro/services',{data:[service]}); this.set('lubricentro/notified',{data:{}});
    if (v2) this.set('clientRecords/c1',client());
    else { this.set('lubricentro/clients',{data:[client()]}); this.set('lubricentro/appointments',{data:[]}); }
    this.writes = [];
  }
  set(path,value) { this.docs.set(path,L.clone(value)); this.versions.set(path,(this.versions.get(path)||0)+1); }
  snap(path) { const value = this.docs.get(path); return {id:path.split('/').at(-1),exists:value!==undefined,metadata:{fromCache:false},data:()=>value===undefined?undefined:L.clone(value)}; }
  collection(name) {
    return {
      doc: id => ({id,path:name+'/'+id,get:async options => {
        assert.equal(options.source,'server'); if(this.offline)throw Error('offline');
        if(this.publicOnly && (name==='lubricentro' && ['notified','clients','appointments'].includes(id))) throw Error('permission-denied');
        return this.snap(name+'/'+id);
      }}),
      where: (field,operator,value) => {
        assert.equal(operator,'==');
        return {get:async options => {
          assert.equal(options.source,'server'); if(this.offline)throw Error('offline');
          return {docs:[...this.docs.keys()].filter(p=>p.startsWith(name+'/') && this.docs.get(p)?.[field]===value).map(p=>this.snap(p))};
        }};
      },
      get: async options => { assert.equal(options.source,'server'); if(this.offline)throw Error('offline'); return {docs:[...this.docs.keys()].filter(p=>p.startsWith(name+'/')).map(p=>this.snap(p))}; }
    };
  }
  async runTransaction(action) {
    for (let attempt=0;attempt<6;attempt++) {
      const read = new Map(), ops = []; let writing = false;
      const result = await action({
        get: async ref => { assert.equal(writing,false,'all reads precede writes'); read.set(ref.path,this.versions.get(ref.path)||0); return this.snap(ref.path); },
        set: (ref,value) => { writing=true; ops.push({path:ref.path,value:L.clone(value)}); },
        delete: ref => { writing=true; ops.push({path:ref.path,remove:true}); }
      });
      if (this.rejectCommit) throw Error('permission-denied');
      if ([...read].some(([path,version])=>(this.versions.get(path)||0)!==version)) continue;
      assert.ok(ops.length<=450);
      for (const op of ops) {
        if(op.remove) { this.docs.delete(op.path); this.versions.set(op.path,(this.versions.get(op.path)||0)+1); }
        else this.set(op.path,op.value);
        this.writes.push(op);
      }
      return result;
    }
    throw Error('transaction-contention');
  }
}

for (const v2 of [false,true]) {
  const label = v2 ? 'V2' : 'legacy';
  test(`${label}: concurrent overlapping reservations allow exactly one`,async()=>{
    const db=new FakeDB(v2), store=createCoordinatedStore(db);
    const outcomes=await Promise.allSettled([store.reserve(appointment('a1')),store.reserve(appointment('a2','09:30'))]);
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    assert.match(outcomes.find(r=>r.status==='rejected').reason.message,/SLOT_TAKEN/);
    assert.equal((await store.read()).appointments.length,1);
  });
  test(`${label}: editing a client preserves somebody else's new client and appointment`,async()=>{
    const db=new FakeDB(v2), first=createCoordinatedStore(db), second=createCoordinatedStore(db);
    const stale=(await first.read()).clients[0];
    await second.saveClient(client('c2','CD456EF'));
    await second.reserve(appointment('new','10:00','c2'));
    await first.saveClient({...stale,name:'Nombre corregido'},stale);
    const actual=await second.read();
    assert.equal(actual.clients.length,2); assert.equal(actual.appointments.length,1);
    if(v2)assert.equal(db.writes.filter(w=>w.path==='clientRecords/c2').length,1,'unrelated document not rewritten');
  });
  test(`${label}: concurrent registration enforces unique patent`,async()=>{
    const store=createCoordinatedStore(new FakeDB(v2));
    const results=await Promise.allSettled([store.saveClient(client('c2','XX123YY')),store.saveClient(client('c3','XX123YY'))]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal((await store.read()).clients.length,2);
  });
  test(`${label}: failed write never changes caller data or persisted records`,async()=>{
    const db=new FakeDB(v2), store=createCoordinatedStore(db), before=await store.read(), expected=L.clone(before.clients[0]);
    db.rejectCommit=true;
    await assert.rejects(store.saveClient({...expected,name:'No guardado'},expected));
    assert.deepEqual(await store.read(),before); assert.deepEqual(expected,before.clients[0]);
  });
  test(`${label}: editing to another client's patent fails`,async()=>{
    const store=createCoordinatedStore(new FakeDB(v2)); await store.saveClient(client('c2','CD456EF'));
    await assert.rejects(store.saveClient({...client(),patent:'CD456EF'},client()),/DUPLICATE_PATENT/);
  });
  test(`${label}: failed client cascade deletion is all or nothing`,async()=>{
    const db=new FakeDB(v2), store=createCoordinatedStore(db);await store.reserve(appointment());
    const before=await store.read();db.rejectCommit=true;
    await assert.rejects(store.deleteClient('c1',client()));assert.deepEqual(await store.read(),before);
    db.rejectCommit=false;await store.deleteClient('c1',client());
    assert.equal((await store.read()).clients.length,0);assert.equal((await store.read()).appointments.length,0);
  });
  test(`${label}: stale update is rejected instead of overwriting a completed service`,async()=>{
    const store=createCoordinatedStore(new FakeDB(v2));await store.reserve(appointment());
    const stale=(await store.read()).appointments[0];
    await store.updateAppointment('a1',{status:'completado'},stale);
    await assert.rejects(store.updateAppointment('a1',{status:'confirmado'},stale),/CONFLICT/);
  });
  test(`${label}: deleting a turn frees every occupied slot`,async()=>{
    const store=createCoordinatedStore(new FakeDB(v2));await store.reserve(appointment());
    await store.deleteAppointment('a1',(await store.read()).appointments[0]);
    await store.reserve(appointment('a2','09:30'));assert.equal((await store.read()).appointments.length,1);
  });
  test(`${label}: concurrent reminder updates preserve both entries`,async()=>{
    const store=createCoordinatedStore(new FakeDB(v2));await Promise.all([store.markNotified('c1_2026-01-01'),store.markNotified('c2_2026-02-01')]);
    assert.equal(Object.keys((await store.read()).notified).length,2);
  });
  test(`${label}: deleted service is not restored from defaults`,async()=>{
    const store=createCoordinatedStore(new FakeDB(v2),[service]);await store.deleteService('s1',service);
    assert.equal((await store.read()).services.length,0);
  });
}

const backup = data => ({format:'lubricentro-esquiu-backup',version:1,project:'lubricentroesquiu-1759a',exportedAt:new Date().toISOString(),data});
test('backup restoration commits all collections together, or none on failure',async()=>{
  const db=new FakeDB(),store=createCoordinatedStore(db),before=await store.read(),next=L.clone(before);
  next.clients.push(client('c2','EF456GH'));next.services[0].price='$12.000';
  db.rejectCommit=true;await assert.rejects(store.restore(backup(next),before));assert.deepEqual(await store.read(),before);
  db.rejectCommit=false;await store.restore(backup(next),before);assert.deepEqual(await store.read(),next);
});
test('backup rejects stale confirmation, missing client relations, duplicates and bad fields',async()=>{
  const store=createCoordinatedStore(new FakeDB()),current=await store.read();
  for(const mutate of [d=>d.clients.push(client()),d=>d.appointments.push(appointment('a1','09:00','missing')),d=>d.clients[0].year='-1',d=>d.notified={bad:{ts:'never'}}]) {
    const data=L.clone(current);mutate(data);assert.throws(()=>L.validateBackup(backup(data)));
  }
  await store.markNotified('c1_2026-01-01');await assert.rejects(store.restore(backup(current),current),/CONFLICT/);
});
test('oversize backup fails before any writes',async()=>{
  const db=new FakeDB(),store=createCoordinatedStore(db),before=await store.read(),data=L.clone(before);
  data.clients=Array.from({length:451},(_,i)=>client('new'+i,'AA'+String(i).padStart(4,'0')+'B'));
  await assert.rejects(store.restore(backup(data),before),/TOO_LARGE/);assert.equal(db.writes.length,0);assert.deepEqual(await store.read(),before);
});
test('migration leaves originals intact and switches both collections atomically',async()=>{
  const db=new FakeDB(false),store=createCoordinatedStore(db),before=await store.read();
  db.rejectCommit=true;await assert.rejects(store.migrate(before));assert.equal(db.docs.has('clientRecords/c1'),false);
  db.rejectCommit=false;await store.migrate(before);assert.deepEqual(await store.read(),before);
  assert.deepEqual(db.docs.get('lubricentro/clients').data,before.clients);
  assert.equal(db.docs.get('lubricentro/schema').data.clientsV2,true);
});
test('migration refuses conflicting destination data instead of deleting it',async()=>{
  const db=new FakeDB(false);db.set('clientRecords/other',client('other','XY123ZZ'));
  await assert.rejects(createCoordinatedStore(db).migrate(),/CONFLICT/);assert.ok(db.docs.has('clientRecords/other'));
});
test('public V2 does not read legacy private documents or notified',async()=>{
  const db=new FakeDB();db.publicOnly=true;const store=createCoordinatedStore(db,[],{public:true});
  await store.read();await store.reserve(appointment());assert.equal((await store.read()).appointments.length,1);
});
test('offline read fails closed instead of returning empty data',async()=>{
  const db=new FakeDB();db.offline=true;await assert.rejects(createCoordinatedStore(db).read());
});
test('local business date and future time validation',()=>{
  const now=new Date('2026-09-07T21:30:00-03:00');assert.equal(L.today(now),'2026-09-07');
  assert.equal(L.future('2026-09-07','08:00',now),false);assert.equal(L.future('','09:00',now),false);
  assert.equal(L.future('2026-09-08','08:00',now),true);assert.equal(L.dateOK('2026-02-30'),false);
});
test('slots reject Sundays, lunch gaps, invalid dates and end-of-day overflow',()=>{
  assert.equal(L.slots('12:30',60,date),null);assert.equal(L.slots('18:30',60,date),null);
  assert.equal(L.slots('09:00',30,'2099-01-04'),null);assert.equal(L.slots('09:00',30,''),null);
  assert.deepEqual(L.slots('09:00',60,date),['09:00','09:30']);
});
test('phone normalization and invalid text',()=>{
  for(const raw of ['3513880155','+54 351 3880155','5493513880155','03513880155'])assert.equal(L.phone(raw),'5493513880155');
  assert.equal(L.phone('3513880155<img>'),'');assert.equal(L.phone('123'),'');
});
test('negative and nonnumeric kilometres are refused',()=>{
  assert.equal(L.kilometres('-1'),false);assert.equal(L.kilometres('12.5'),false);assert.equal(L.kilometres(''),true);assert.equal(L.kilometres('',true),false);
});
test('field order returned by Firestore does not cause false conflicts',async()=>{
  const db=new FakeDB(),store=L.createStore(db),expected=(await store.read()).clients[0];
  db.set('clientRecords/c1',Object.fromEntries(Object.entries(client()).reverse()));
  await store.saveClient({...expected,name:'Actualizado'},expected);
  assert.equal((await store.read()).clients[0].name,'Actualizado');
});
test('historical empty notification arrays are read as empty marks',async()=>{
  const db=new FakeDB();db.set('lubricentro/notified',{data:[]});
  assert.deepEqual((await L.createStore(db).read()).notified,{});
});
test('HTML inline scripts compile and every local script exists',()=>{
  for(const name of ['index.html','admin.html']) {
    const html=fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');
    for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
    for(const m of html.matchAll(/<script src="(?!https:)([^"]+)"/g))assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',m[1])));
  }
});

test('active compatibility mode reads and writes without accessing systemLocks',async()=>{
  const db=new FakeDB(), original=db.collection.bind(db);
  db.collection=name=>{assert.notEqual(name,'systemLocks','do not use an undeployed rule');return original(name);};
  const store=L.createStore(db,[],{public:true});
  const old=(await store.read()).clients[0];
  await store.saveClient(client('c2','CD456EF'));
  await store.saveClient({...old,name:'Editado'},old);
  await store.reserve(appointment());
  assert.equal((await store.read()).clients.length,2);
  assert.equal(db.writes.some(w=>w.path.startsWith('systemLocks/')),false);
});
test('active mode preserves concurrent edits to distinct records',async()=>{
  const db=new FakeDB(),store=L.createStore(db);await store.saveClient(client('c2','CD456EF'));
  await Promise.all([store.saveClient({...client(),name:'Uno'},client()),store.saveClient({...client('c2','CD456EF'),name:'Dos'},client('c2','CD456EF'))]);
  assert.deepEqual((await store.read()).clients.map(c=>c.name),['Uno','Dos']);
});
test('active mode rejects a write racing an edit to the same record',async()=>{
  const store=L.createStore(new FakeDB());
  const out=await Promise.allSettled([store.saveClient({...client(),name:'Uno'},client()),store.saveClient({...client(),name:'Dos'},client())]);
  assert.equal(out.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(out.filter(r=>r.status==='rejected').length,1);
});
test('V2 quick appointment update writes only its record and rejects a stale copy',async()=>{
  const db=new FakeDB(),store=L.createStore(db);
  await store.reserve(appointment());
  const expected=(await store.read()).appointments[0];
  let collectionQueries=0;
  const original=db.collection.bind(db);
  db.collection=name=>{
    const col=original(name);
    return {...col,get:async options=>{collectionQueries++;return col.get(options);}};
  };
  db.set('appointmentRecords/other',appointment('other','11:00'));
  const updated=await store.updateAppointmentRecord('a1',{status:'completado'},expected);
  assert.equal(updated.status,'completado');
  assert.equal(collectionQueries,0);
  assert.equal(db.docs.get('appointmentRecords/other').status,'pendiente');
  await assert.rejects(store.updateAppointmentRecord('a1',{status:'cancelado'},expected),/CONFLICT/);
});
test('legacy quick appointment update uses only the appointment transaction',async()=>{
  const db=new FakeDB(false),store=L.createStore(db);
  await store.reserve(appointment());
  const expected=(await store.read()).appointments[0];
  let serverReads=0;
  const original=db.collection.bind(db);
  db.collection=name=>{
    const col=original(name);
    return {...col,doc:id=>{const doc=col.doc(id);return {...doc,get:async options=>{
      serverReads++;return doc.get(options);
    }};}};
  };
  const updated=await store.updateAppointmentRecord('a1',{status:'confirmado'},expected);
  assert.equal(updated.status,'confirmado');
  assert.equal(serverReads,0);
  assert.equal((await store.read()).appointments[0].status,'confirmado');
});
for (const v2 of [false,true]) {
  test(`${v2 ? 'V2' : 'legacy'}: quick reservation checks the occupied slots and avoids a full reload`,async()=>{
    const db=new FakeDB(v2),store=L.createStore(db);
    await store.read();
    let fullQueries=0,dayQueries=0,serverDocReads=0;
    const original=db.collection.bind(db);
    db.collection=name=>{
      const col=original(name);
      return {
        ...col,
        doc:id=>{const doc=col.doc(id);return {...doc,get:async options=>{serverDocReads++;return doc.get(options);}};},
        get:async options=>{fullQueries++;return col.get(options);},
        where:(field,operator,value)=>{dayQueries++;return col.where(field,operator,value);}
      };
    };
    const saved=await store.reserveAppointmentRecord(appointment());
    assert.equal(saved.id,'a1');
    assert.equal(fullQueries,0);
    assert.equal(serverDocReads,0);
    assert.equal(dayQueries,v2 ? 1 : 0);
    await assert.rejects(store.reserveAppointmentRecord(appointment('overlap','09:30')),/SLOT_TAKEN/);
    assert.equal((await store.read()).appointments.length,1);
  });
}
test('quick reservation does not change records when the transaction fails',async()=>{
  const db=new FakeDB(),store=L.createStore(db);
  await store.read();db.rejectCommit=true;
  await assert.rejects(store.reserveAppointmentRecord(appointment()));
  assert.equal(db.docs.has('appointmentRecords/a1'),false);
});
test('quick reservation keeps the existing safe path if Firebase rejects the day query',async()=>{
  const db=new FakeDB(),store=L.createStore(db);
  await store.read();
  const original=db.collection.bind(db);
  db.collection=name=>{
    const col=original(name);
    return name==='appointmentRecords'
      ? {...col,where:()=>({get:async()=>{throw Object.assign(Error('missing index'),{code:'failed-precondition'});}})}
      : col;
  };
  const saved=await store.reserveAppointmentRecord(appointment());
  assert.equal(saved.id,'a1');
  assert.equal(db.docs.get('appointmentRecords/a1').time,'09:00');
});
test('legacy quick reservations cannot take overlapping slots concurrently',async()=>{
  const db=new FakeDB(false),store=L.createStore(db);
  await store.read();
  const results=await Promise.allSettled([
    store.reserveAppointmentRecord(appointment('a1')),
    store.reserveAppointmentRecord(appointment('a2','09:30'))
  ]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/SLOT_TAKEN/);
});
test('schema hint avoids the first extra schema round trip and recovers if stale',async()=>{
  const db=new FakeDB();
  let schemaReads=0;
  const original=db.collection.bind(db);
  db.collection=name=>{
    const col=original(name);
    return {...col,doc:id=>{const doc=col.doc(id);return {...doc,get:async options=>{
      if(name==='lubricentro' && id==='schema')schemaReads++;
      return doc.get(options);
    }};}};
  };
  const store=L.createStore(db,[],{schemaHint:{clientsV2:true,appointmentsV2:true}});
  assert.equal((await store.read()).clients.length,1);
  assert.equal(schemaReads,1);
  const legacy=new FakeDB(false);
  const stale=L.createStore(legacy,[],{schemaHint:{clientsV2:true,appointmentsV2:true}});
  assert.equal((await stale.read()).clients.length,1);
  const saved=await stale.reserveAppointmentRecord(appointment());
  assert.equal(saved.id,'a1');
});
test('active mode documents the remaining unseen-insert race (coordination disabled by request)',async()=>{
  const store=L.createStore(new FakeDB());
  const results=await Promise.allSettled([store.reserve(appointment('a1')),store.reserve(appointment('a2','09:30'))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,2);
});

function pageContext(file,db=new FakeDB()) {
  const elements=new Map();
  const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){}});return elements.get(id);},
    querySelectorAll(){return [];},querySelector(){return null;},addEventListener(){},createElement(){return {classList:{add(){},remove(){}},remove(){}};}};
  const context=vm.createContext({console:{log(){},error(){}},document,Lubri:L,crypto:require('node:crypto').webcrypto,
    firebase:{initializeApp(){},firestore:()=>db,auth:()=>({currentUser:{email:'gonzitassi@gmail.com'}})},
    navigator:{userAgent:''},window:{location:{search:'?client=c1&view=libretito'}},URLSearchParams,confirm:()=>true,setTimeout(){},requestAnimationFrame(){}});
  const html=fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script.slice(0,file==='admin.html'?script.lastIndexOf('(async () => {'):script.lastIndexOf('initializeClient();')),context);
  return {context,document,db};
}
test('shared history link retains the selected client',()=>{
  const {context}=pageContext('index.html');
  vm.runInContext('CLIENTS=[{id:"c1",name:"Prueba",vehicleType:"auto"}]; openSharedLibretito()',context);
  assert.equal(vm.runInContext('ME.id',context),'c1');
});
test('failed registration keeps session and clients unchanged',async()=>{
  const {context,document,db}=pageContext('index.html');db.rejectCommit=true;
  const values={cName:'Prueba',cWa:'3513880155',cPatReg:'CD456EF',cVtype:'auto',cBrand:'Ford',cModel:'Ka',cYear:'2020',cMotor:'1.6'};
  for(const [id,value] of Object.entries(values))document.getElementById(id).value=value;
  await vm.runInContext('doRegisterClient()',context);
  assert.equal(vm.runInContext('CLIENTS.length',context),0);assert.equal(vm.runInContext('ME',context),null);
});
test('successful registration adds exactly one client and enters their home',async()=>{
  const {context,document}=pageContext('index.html');
  for(const [id,value] of Object.entries({cName:'Prueba',cWa:'3513880155',cPatReg:'CD456EF',cVtype:'auto',cBrand:'Ford',cModel:'Ka',cYear:'2020',cMotor:'1.6'}))document.getElementById(id).value=value;
  await vm.runInContext('doRegisterClient()',context);
  assert.equal(vm.runInContext('CLIENTS.length',context),2);assert.equal(vm.runInContext('ME.patent',context),'CD456EF');
});
test('client and admin escape untrusted displayed data and handler arguments',()=>{
  for(const file of ['index.html','admin.html']) {
    const {context,document}=pageContext(file);
    const payload='<img src=x onerror=alert(1)>';
    if(file==='index.html') {
      vm.runInContext('ME='+JSON.stringify({...client(),patent:payload,year:payload})+';renderClientHome()',context);
      assert.equal(document.getElementById('clientArea').innerHTML.includes(payload),false);
    } else {
      vm.runInContext('AppState.clients='+JSON.stringify([{...client(),id:"a');alert(1);//",patent:payload,whatsapp:payload,year:payload}])+';drawClientes()',context);
      const result=document.getElementById('tClientes').innerHTML;
      assert.equal(result.includes(payload),false);assert.equal(result.includes("a');alert"),false);
    }
  }
});
test('admin failed status change leaves in-memory appointment unchanged',async()=>{
  const {context,db}=pageContext('admin.html');db.set('appointmentRecords/a1',appointment());
  await vm.runInContext('AppState.loadAll()',context);db.rejectCommit=true;
  await vm.runInContext('updAppt("a1","confirmado")',context);
  assert.equal(vm.runInContext('AppState.appointments[0].status',context),'pendiente');
});
test('admin saves a new appointment through the quick path and updates its visible state',async()=>{
  const {context,document,db}=pageContext('admin.html');
  await vm.runInContext('AppState.loadAll()',context);
  for(const [id,value] of Object.entries({mApptClientId:'c1',mAService:'s1',mADate:date,mATime:'09:00',mAKm:'15000'}))
    document.getElementById(id).value=value;
  await vm.runInContext('doSaveAppt()',context);
  assert.equal(vm.runInContext('AppState.appointments.length',context),1);
  assert.equal([...db.docs.keys()].filter(path=>path.startsWith('appointmentRecords/')).length,1);
});
test('completing a service reserves WhatsApp on the click, then opens its message after saving',async()=>{
  const {context,document,db}=pageContext('admin.html');
  db.set('appointmentRecords/a1',{...appointment(),status:'confirmado'});
  await vm.runInContext('AppState.loadAll()',context);
  document.getElementById('mCompId').value='a1';
  document.getElementById('mCompKm').value='15000';
  document.getElementById('mCompOil').value='Shell';
  const events=[];
  const tab={closed:false,document:{body:{}},location:{replace(url){events.push(['navigate',url]);}},close(){this.closed=true;}};
  context.navigator.userAgent='Windows';
  context.window.open=(url)=>{events.push(['open',url]);return tab;};
  vm.runInContext('completingAppointment=AppState.appointments[0]',context);
  await vm.runInContext('doCompleteAppt()',context);
  assert.equal(events[0][1],'about:blank');
  assert.match(events[1][1],/^whatsapp:\/\/send\?phone=5493513880155&text=/);
  assert.equal(db.docs.get('appointmentRecords/a1').status,'completado');
  assert.match(document.getElementById('waFollowupText').textContent,/tocá Enviar/);
  assert.match(document.getElementById('waFollowupWebLink').href,/^https:\/\/web\.whatsapp\.com\/send\?phone=/);
});
test('failed service save closes its reserved WhatsApp tab',async()=>{
  const {context,document,db}=pageContext('admin.html');
  db.set('appointmentRecords/a1',{...appointment(),status:'confirmado'});
  await vm.runInContext('AppState.loadAll()',context);
  document.getElementById('mCompId').value='a1';
  document.getElementById('mCompKm').value='15000';
  document.getElementById('mCompOil').value='Shell';
  db.rejectCommit=true;
  const tab={closed:false,document:{body:{}},location:{replace(){throw Error('should not navigate');}},close(){this.closed=true;}};
  context.window.open=()=>tab;
  vm.runInContext('completingAppointment=AppState.appointments[0]',context);
  await vm.runInContext('doCompleteAppt()',context);
  assert.equal(tab.closed,true);
  assert.equal(db.docs.get('appointmentRecords/a1').status,'confirmado');
});
test('blocked popup keeps a direct WhatsApp link after the service is saved',async()=>{
  const {context,document,db}=pageContext('admin.html');
  db.set('appointmentRecords/a1',{...appointment(),status:'confirmado'});
  await vm.runInContext('AppState.loadAll()',context);
  document.getElementById('mCompId').value='a1';
  document.getElementById('mCompKm').value='15000';
  document.getElementById('mCompOil').value='Shell';
  let opens=0;
  context.navigator.userAgent='Windows';
  context.window.open=()=>{opens++;return null;};
  vm.runInContext('completingAppointment=AppState.appointments[0]',context);
  await vm.runInContext('doCompleteAppt()',context);
  assert.equal(opens,1);
  assert.equal(db.docs.get('appointmentRecords/a1').status,'completado');
  assert.match(document.getElementById('waFollowupText').textContent,/bloqueó/);
  assert.match(document.getElementById('waFollowupLink').href,/^whatsapp:\/\/send\?phone=5493513880155&text=/);
  assert.match(document.getElementById('waFollowupWebLink').href,/^https:\/\/web\.whatsapp\.com\/send\?phone=5493513880155&text=/);
});
