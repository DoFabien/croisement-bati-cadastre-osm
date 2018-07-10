
const minimist = require('minimist')
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const async = require('async');

const getFeuillesByCom = require('./getFeuillesByCom.js');
const getOsmBuildings = require('./getOsmBuildings.js');
const getEdigeoAndConvertToGeojson = require('./getEdigeoAndConvertToGeojson.js');
const croisementOsmCadastre = require('./croisementOsmCadastre.js');
const projgeojson = require("proj-geojson");


var args = minimist(process.argv.slice(2), {
    string: 'id_insee',
    number: 'tx'
  })

if (!args.id_insee){
    console.log('Veuillez indiquer un code insee : node index.js -id_insee 38001')
}
let id_insee = args.id_insee // '38001';
let tx = args.tx / 100 || 0.8;

const feuillesLinks = getFeuillesByCom(id_insee);

let geojsonCommune;
let geojsonBati;

let q = async.queue(function(task, callback) {
    let splitLink = task.link.split('/');
    let filename = splitLink[splitLink.length-1]
    console.log('Téléchargement et conversion de la feuille du cadastre ', filename, ' ...');

    getEdigeoAndConvertToGeojson(task.link, id_insee.substr(0,2)).then(ediGeojson => {
        if (!geojsonBati){
            geojsonBati = ediGeojson['EDI_BATIMENT']
        } else {
            if (ediGeojson['EDI_BATIMENT']){
                let featureBati = ediGeojson['EDI_BATIMENT'].features;
                for(let i = 0; i < featureBati.length; i++){
                    geojsonBati.features.push(featureBati[i])
                }
            }

        }
        if (!geojsonCommune){
            geojsonCommune = ediGeojson['EDI_COMMUNE'];
        }
        callback();
    });
}, 4);

for (let i = 0; i < feuillesLinks.length; i++){ //feuillesLinks.length
    q.push({link: feuillesLinks[i]}, function(err) {

    });
}
// callback
q.drain = function() {
    const codeEPSG = geojsonBati.crs.type + ':' + geojsonBati.crs.properties.code;
    console.log('Reprojection des données du cadastre en EPSG:4326...')
    geojsonBati = projgeojson(geojsonBati, codeEPSG, 'EPSG:4326', 7);
    geojsonCommune = projgeojson(geojsonCommune, codeEPSG, 'EPSG:4326', 7);
    
    console.log('Téléchargement des bati OSM...');
    let osmBuilding = getOsmBuildings(geojsonCommune);

    console.log('Croisement des batis : cadastre <=> OSM...')
    let results = croisementOsmCadastre(geojsonBati, osmBuilding)

    // const outPath = path.join('OUT', id_insee);
    mkdirp.sync(path.join('OUT', id_insee))
    console.log('Ecriture des geojson dans '+ path.join('OUT', id_insee))
    for (let k in results){
        fs.writeFileSync(path.join('OUT', id_insee,id_insee +'-'+ k + '.geojson') , JSON.stringify(results[k]))
    }
    
    fs.writeFileSync(path.join('OUT', id_insee,id_insee +'-osmOriginal.geojson'), JSON.stringify(osmBuilding))
    

    console.log(':-)');
};






