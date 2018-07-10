// - lister les feuilles d'une communes depuis:
//     https://cadastre.data.gouv.fr/data/dgfip-pci-vecteur/2018-04-03/edigeo/feuilles/38/38001/



const request = require('sync-request');

const getFeuillesByCom = function(id_insee){
const dep = id_insee.substr(0,2);

const url = 'https://cadastre.data.gouv.fr/data/dgfip-pci-vecteur/2018-04-03/edigeo/feuilles/'+dep+'/'+id_insee+'/'

let response = request('GET', url);

if (response.statusCode >= 300){
    var err = new Error(
        'Server responded with status code '+ response.statusCode

      );
      err.statusCode = response.statusCode;

      console.log('OUPS ...' + response.statusCode + ' => ' + url)
      return err;
}


let resStr = response.getBody('utf8');
let filesUrls = [];
var re = /href=".*"/g;
const matchs = resStr.match(re);
for (let i =1; i < matchs.length; i++){
    let file = matchs[i].replace('href="','').replace('"','');
    filesUrls.push(url + file);
}
return filesUrls
}

module.exports = getFeuillesByCom;