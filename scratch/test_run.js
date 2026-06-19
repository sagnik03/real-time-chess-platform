import fs from 'fs';
console.log("ESM works!", fs.readFileSync('PROJECT_GUIDE.txt', 'utf8').substring(0, 24));
