const jwt = require('jsonwebtoken');
function requireAuth(req,res,next){
  const h=req.headers.authorization||'';
  const [scheme,token]=h.split(' ');
  if(scheme!=='Bearer'||!token) return res.status(401).json({error:'Giriş yapmanız gerekiyor.'});
  try{req.auth=jwt.verify(token,process.env.JWT_SECRET);next();}
  catch{return res.status(401).json({error:'Oturum geçersiz veya süresi dolmuş.'});}
}
module.exports={requireAuth};
