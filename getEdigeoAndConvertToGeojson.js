
const request = require('sync-request');
var edigeoTogeojson = require('edigeo-to-geojson');
const decompress = require("decompress");

const url = 'https://cadastre.data.gouv.fr/data/dgfip-pci-vecteur/2018-04-03/edigeo/feuilles/38/38001/edigeo-380010000A01.tar.bz2';


const getEdigeoAndConvertToGeojson = function (link, dep) {
    let res = request('GET', link) //.getBody('utf8')
    return new Promise((resolve, reject) => {
    decompress(res.body)
        .then(files => {
            const bufferData = { 'THF': undefined, 'QAL': undefined, 'GEO': undefined, 'VEC': [] }

            for (let i = 0; i < files.length; i++) {
                if (/\.THF$/.test(files[i].path)) {
                    bufferData.THF = files[i].data;

                } else if (/\.VEC$/.test(files[i].path)) {
                    bufferData.VEC.push(files[i].data);

                } else if (/\.QAL$/.test(files[i].path)) {
                    bufferData.QAL = files[i].data;

                } else if (/\.GEO$/.test(files[i].path)) {
                    bufferData.GEO = files[i].data;
                }
            }
            const geojsons =  edigeoTogeojson(bufferData, dep, { toWgs84: false, filter: true, geomHash: false })
           resolve(geojsons);
        })
    })
}

module.exports = getEdigeoAndConvertToGeojson
