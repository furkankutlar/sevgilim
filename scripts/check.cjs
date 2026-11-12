const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const files=['script.js','chat.js','mobile.js','daily-question.js','price-tracker.js','wallet.js','wallet-model.js','sw.js',...['api','lib'].flatMap(dir=>fs.readdirSync(dir).filter(file=>/\.(?:c?js)$/.test(file)).map(file=>dir+'/'+file))];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log('Syntax checked '+files.length+' application files.');
