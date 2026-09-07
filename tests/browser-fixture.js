/* Only injected by preview.cjs on localhost. Never loaded by the real pages. */
(() => {
  const initial = {
    'lubricentro/schema':{data:{clientsV2:true,appointmentsV2:true}},
    'lubricentro/notified':{data:{}},
    'clientRecords/demo':{id:'demo',name:'Cliente de prueba',whatsapp:'5493513880155',patent:'AB123CD',vehicleType:'auto',brand:'Ford',model:'Ka',year:'2020',motor:'1.6'},
    'appointmentRecords/demo-history':{id:'demo-history',clientId:'demo',patent:'AB123CD',vehicleDesc:'Ford Ka 2020',date:'2026-01-05',time:'09:00',service:'s1',serviceName:'Cambio de Aceite',status:'completado',pit:'auto',blockedSlots:['09:00'],km:'10000',nextKm:20000,nextDate:'2026-07-05',oilBrand:'Aceite de prueba',notes:'Historial ficticio',checklist:{aceite_motor:'done',filtro_aceite:'done'}}
  };
  const data = JSON.parse(sessionStorage.getItem('lubri-test-fixture') || 'null') || initial;
  let rev=0;
  const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
  const snap=path=>({id:path.split('/').at(-1),exists:path in data,metadata:{fromCache:false},data:()=>copy(data[path])});
  const db={collection:name=>({doc:id=>({path:name+'/'+id,id,get:async()=>snap(name+'/'+id)}),get:async()=>({docs:Object.keys(data).filter(k=>k.startsWith(name+'/')).map(snap)})}),
    async runTransaction(action){for(let n=0;n<6;n++){const version=rev,ops=[];await action({get:async r=>snap(r.path),set:(r,v)=>ops.push([r.path,copy(v)]),delete:r=>ops.push([r.path])});if(version!==rev)continue;for(const [key,value] of ops){if(value===undefined)delete data[key];else data[key]=value;}rev++;sessionStorage.setItem('lubri-test-fixture',JSON.stringify(data));return;}throw Error('contention');}};
  const auth={currentUser:null,async signInWithEmailAndPassword(email){this.currentUser={email};},async signOut(){this.currentUser=null;},onAuthStateChanged(callback){callback(this.currentUser);},async sendPasswordResetEmail(){}};
  window.firebase={initializeApp(){},firestore:()=>db,auth:()=>auth};
  window.addEventListener('DOMContentLoaded',()=>{
    const note=document.createElement('div');note.textContent='PRUEBA LOCAL · datos ficticios · sin conexión a Firebase';
    note.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;text-align:center;background:#064e3b;color:white;font:12px sans-serif;padding:4px';document.body.appendChild(note);
  });
})();
