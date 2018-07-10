const request = require('sync-request');
const osmtogeojson = require('osmtogeojson');
const turf = require('@turf/turf')


const getOsmBati = function(geojsonCommune) {
    const bboxCommune = turf.bbox(geojsonCommune);
    const bboxStrOverpass = '(' + [bboxCommune[1], bboxCommune[0], bboxCommune[3], bboxCommune[2]].join(',') + ')';

    let req = '[out:json][timeout:200];(way["building"]' + bboxStrOverpass + ';);out meta;>;out meta;'
    const res = JSON.parse(request('GET', 'https://overpass-api.de/api/interpreter?data=' + req).getBody('utf8'));
    const geojsonOsmBuilding = osmtogeojson(res);

    let featureCommune = geojsonCommune.features[0];
    let featuresBati = geojsonOsmBuilding.features;
    let featuresBatiInsideCommune = []

    // On exclue les bati hors de la commune
    for (let i =0; i < featuresBati.length; i++){
        if (featuresBati[i].geometry.type === 'Polygon' || featuresBati[i].geometry.type === 'MultiPolygon' ){
            const pointOnPolygon = turf.pointOnFeature(featuresBati[i]);
            if (turf.booleanPointInPolygon(pointOnPolygon, featureCommune)){
                featuresBatiInsideCommune.push(featuresBati[i])
            }
        }

    }
    geojsonOsmBuilding.features = featuresBatiInsideCommune;

    return geojsonOsmBuilding
}

module.exports = getOsmBati;


