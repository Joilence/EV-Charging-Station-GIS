from flask import Flask, jsonify
from flask_cors import CORS
import json
from time import sleep

import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
CORS(app)


sleep(5)

delStations = """
DROP TABLE IF EXISTS charging_stations
"""
createStations = """
CREATE TABLE charging_stations(
   X                       VARCHAR(1024) NOT NULL 
  ,Y                       VARCHAR(1024) NOT NULL 
  ,OBJECTID                VARCHAR(1024)  NOT NULL PRIMARY KEY
  ,Betreiber               VARCHAR(84) NOT NULL
  ,Adresse                 VARCHAR(55) NOT NULL
  ,Postleitzahl_Ort        VARCHAR(40) NOT NULL
  ,Bundesland              VARCHAR(22) NOT NULL
  ,Längengrad_in_DG        VARCHAR(1024) NOT NULL
  ,Breitengrad_in_DG       VARCHAR(1024) NOT NULL
  ,Inbetriebnahmedatum     VARCHAR(19) NOT NULL
  ,Anschlussleistung_kW_   VARCHAR(1024) NOT NULL
  ,Art_der_Ladeeinrichtung VARCHAR(22) NOT NULL
  ,Anzahl_Ladepunkte       VARCHAR(1024)  NOT NULL
  ,Steckertypen1           VARCHAR(68) NOT NULL
  ,P1_kW_                  VARCHAR(1024) NOT NULL

  ,Steckertypen2           VARCHAR(56)
  ,P2_in_kW                VARCHAR(1024)

  ,Steckertypen3           VARCHAR(37)
  ,P3_kW_                  VARCHAR(1024)

  ,Steckertypen4           VARCHAR(64)
  ,P4_kW_                  VARCHAR(1024)

);
"""

delRestaurants = """DROP TABLE IF EXISTS restaurants"""
createRestaurants = """
CREATE TABLE restaurants(
    id VARCHAR(100) NOT NULL PRIMARY KEY
   ,rating   VARCHAR(100)  NOT NULL
    ,img VARCHAR(500) NOT NULL
  ,name     VARCHAR(100) NOT NULL
    ,link VARCHAR(500) NOT NULL
  ,location VARCHAR(100) NOT NULL
  ,type     VARCHAR(100) NOT NULL
  ,lat      VARCHAR(100) NOT NULL
  ,lng      VARCHAR(100) NOT NULL
);
"""

with psycopg2.connect(host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass") as conn:
    with conn.cursor() as cursor:
        
        cursor.execute(delStations)
        cursor.execute(createStations)
        with open('./data/charging_stations.csv', 'r') as f:
            cursor.copy_from(f, 'charging_stations', sep='|',)

        cursor.execute(delRestaurants)
        cursor.execute(createRestaurants)
        with open('./data/restaurant_score.csv', 'r') as f:
            cursor.copy_from(f, 'restaurants', sep='|',)

        




    conn.commit()












@app.route('/numbars', methods=["GET", "POST"])
def pubs():
    # query to find the number of bars and pubs per city in our complete dataset
    query = """WITH cities AS (
	SELECT osm_id, name, way AS geom
	FROM planet_osm_polygon pop
	WHERE pop.admin_level = '6' AND name = 'Freiburg im Breisgau'
	UNION
	SELECT osm_id, name, ST_Union(way) AS geom
	FROM planet_osm_polygon pop
	WHERE admin_level = '8'
	GROUP BY osm_id, name
), bars AS (
	SELECT osm_id, way as geom
	FROM planet_osm_polygon
	WHERE amenity IN ('bar', 'pub')
	UNION
	SELECT osm_id, way AS geom
	FROM planet_osm_point
	WHERE amenity IN ('bar', 'pub')
)
SELECT c.osm_id, c.name, ST_AsGeoJSON(c.geom) AS geometry, count(b.*) AS numbars
FROM cities c LEFT JOIN bars b ON ST_Contains(c.geom, b.geom)
GROUP BY c.osm_id, c.name, c.geom
"""

    # get results
    with psycopg2.connect(host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass") as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query)
            results = cursor.fetchall()

    
    # convert results to a GeoJSON
    geojsons = []
    for result in results:
        geojsons.append({
            "type": "Feature",
            "id": result['osm_id'],
            "properties": {
                "name": result['name'],
                "numbars": float(result['numbars'])
            },
            "geometry": json.loads(result['geometry'])
        })

    # return all results as a feature collection
    return jsonify({
        "type": "FeatureCollection", "features": geojsons
    }), 200
