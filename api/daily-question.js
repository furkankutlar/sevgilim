const { istanbulDate, validDate, createQuestionService } = require('../lib/daily-question.cjs');
const getQuestion = createQuestionService();

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if(!['GET', 'HEAD'].includes(req.method)){
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Bu işlem desteklenmiyor.' });
  }
  const date = req.query?.date ?? istanbulDate();
  if(!validDate(date)){
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'Tarih YYYY-AA-GG biçiminde olmalı.' });
  }
  try{
    const question = await getQuestion(date);
    // İstemci tarihi URL'ye ekler; İstanbul gece yarısında yeni önbellek anahtarı oluşur.
    res.setHeader('Cache-Control', req.query?.date ? 'public, max-age=300, s-maxage=21600' : 'no-store');
    if(req.method === 'HEAD') return res.status(200).end();
    return res.status(200).json(question);
  }catch(error){
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'Günün sorusu şu anda yüklenemiyor.' });
  }
};
