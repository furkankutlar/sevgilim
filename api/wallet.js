const {createWalletStore}=require('../lib/wallet-store.cjs');
const store=createWalletStore();
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    if(req.method==='GET')return res.status(200).json(await store.read());
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Bu işlem desteklenmiyor.'});}
    let origin;try{origin=new URL(req.headers.origin);}catch(e){}
    if(!origin||origin.protocol!=='https:'||origin.host!==req.headers.host)return res.status(403).json({error:'Geçersiz istek kaynağı.'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'JSON gerekli.'});
    if(JSON.stringify(req.body||{}).length>2048)return res.status(400).json({error:'İstek çok uzun.'});
    return res.status(200).json(await store.mutate(req.body||{}));
  }catch(e){
    if(e.status)return res.status(e.status).json({error:e.message});
    console.error('Wallet service unavailable',e.name);
    return res.status(503).json({error:'Cüzdana ulaşılamadı. Kaydın sonucu belirsizse listeyi yenile; aynı işlemi tekrar denemek çift kayıt oluşturmaz.'});
  }
};
