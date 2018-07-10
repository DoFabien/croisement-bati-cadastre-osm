# croisement-bati-cadastre-osm
Ce script en node permet de croiser les batiments en provenance de la dernière version du cadastre aux données OSM d'une commune.

Il produit essentielement 3 geojson qui nous permet de facilité la mise à jour des batiments dans Openstreetmap :
    - {code-insee}-newBati.geojson ==> Potentielement de nouveaux batis qui sont présents dans le cadastre mais pas dans OSM
    - {code-insee}-oldBati.geojson ==> Potentielement d'anciens batis qui ont été détruits. Ils sont présents dans OSM mais pas dans le cadastre
    - {code-insee}-conflictBati.geojson ==> Les batiments du cadastre qui intersectent un batiment OSM avec un taux de recouvrement inférieur à une valeur (80% par défaut)

# Usage
Une fois dans le répértoire, pour installer les dépendances :
```sh
npm install
```

Pour lancer le traitement sur la commune 38001 en utilisant un taux de recouvrement de 80%
```sh
node index.js --id_insee 38001
```

# Fonctionnement du script
    1- liste les feuilles de la communes depuis: https://cadastre.data.gouv.fr/data/dgfip-pci-vecteur/2018-04-03/edigeo/feuilles/38/38001/
    2 - Télécharge chaque "feuille" puis, 
        - La décompresse du format tar.gz (decompress)
        - La convertit du format EDIGEO en geojson (edigeo-to-geojson)
        - Ne conserve que les batiments qui sont poussés dans le geojson final des batis
    3 - Reprojection de ces batiments en EPSG:4326
    4 - Téléchargement des batiments OSM via l'overpassApi selon la bbox de la commune (le polygone de la commune a été récupéré dans l'étape 2...)
        - On ne conserve que les batiments qui sont à l'interieur de la commune
    5 - On croise la geométrie de ces 2 couches
        - On utilise Flatbush qui est tellement rapide... Mais que pour comparer 2 bbox
        - Si la bbox interscecte au moins une bbox de l'autre couche, on génére son interscection (martinez-polygon)
        - On calcule le taux de recouvrement à partir de la surface de l'objet et la somme des surfaces des interscections
    6 - On répartit les batis dans les geojson finaux selon leurs taux de recouvrement

    
Les sorties se trouvent dans le repertoire ./OUT/{code-insee}.
Il ne vous reste plus qu'à les utiliser pour mettre à jour les batis de votre commune dans OSM ! Il existe un plugin dans JOSM permettant d'ouvrir directement les geojson.

Attention tout de mếme, les resultats n'ont aucune vocation à être utilisés directement pour importer les nouveaux bâtiments.
Cela nécessite au préalable une verification minutieuse. Par exemple, il se peut, et il est même très probable, que certains bâtis apparaissant comme "nouveaux" alors qu'ils ne le sont pas vraiment, il suffit d'un décallage de quelques mètres entre les 2 jeux de données pour donner un faux positif. Idem pour les anciens batis.

