from flask import Flask, jsonify, request
from flask_cors import CORS
import json
from time import sleep
import requests

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
geometryStations="""
SELECT AddGeometryColumn ('charging_stations','geom',4326,'POINT',2);
UPDATE charging_stations SET geom = ST_SetSRID(ST_MakePoint(x::float, y::float), 4326);
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
geometryRestaurants="""
SELECT AddGeometryColumn ('restaurants','geom',4326,'POINT',2);
UPDATE restaurants SET geom = ST_SetSRID(ST_MakePoint(lat::float, lng::float), 4326);
"""

with psycopg2.connect(host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass") as conn:
    with conn.cursor() as cursor:
        cursor.execute(delStations)
        cursor.execute(createStations)
        with open('./data/charging_stations.csv', 'r') as f:
            cursor.copy_from(f, 'charging_stations', sep='|', )
        cursor.execute(geometryStations)

        cursor.execute(delRestaurants)
        cursor.execute(createRestaurants)
        with open('./data/restaurant_score.csv', 'r') as f:
            cursor.copy_from(f, 'restaurants', sep='|', )
        cursor.execute(geometryRestaurants)

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

    results = execQuery(query)

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


#####################################################################################
######################## Distance Functions #########################################
#####################################################################################

@app.route('/distance', methods=["POST"])
def distanceQuery():
    geometry1 = request.json["geom1"]
    geometry2 = request.json["geom2"]
    return str(calculateDistance(geometry1, geometry2))

def calculateDistance(geometry1, geometry2):
    query = f"""
        SELECT ST_Distance(
    		ST_GeomFromText('{geometry1}',4326),
    		ST_GeomFromText('{geometry2}', 4326),
    		true
    	);
    """
    return execDistanceQuery(query)

def calculateDistanceGeography(geography1, geography2):
    query = f"""
    SELECT ST_Distance(
		ST_GeographyFromText('{geography1}'),
		ST_GeographyFromText('{geography2}'), 
		true
	);
"""
    return execDistanceQuery(query)

def execDistanceQuery(query):
    return execQuery(query)[0]["st_distance"]


#####################################################################################
######################## General Util Functions #####################################
#####################################################################################

def execQuery(query):
    # get results
    with psycopg2.connect(host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass") as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query)
            return cursor.fetchall()

def latLongToGeometry(lat, long):
    return f'POINT({lat} {long})'
    


    
#####################################################################################
######################## STATIONS ###################################################
#####################################################################################

@app.route('/stations', methods=["POST"])
def getStations():
    routepoint= request.json["routepoint"]
    distance = request.json["distance"]
    return queryStations(routepoint, distance)

def queryStations(routepoint, distance):
    #transform coordinates to point
    # ST_SetSRID(ST_MakePoint(40, 50), 4326)

    #cast way to geography -> distance in meters
    query= f"""
    SELECT *
    FROM charging_stations cs 
    WHERE ST_Distance(Geography(ST_Transform(cs.geom ,4326)), '{routepoint}') < '{distance}'
    """
    return execQuery(query)


#####################################################################################
######################## RESTAURANTS ################################################
#####################################################################################

@app.route('/restaurants', methods=["POST"])
def getRestaurants():
    station= request.json["station"]
    distance = request.json["distance"]
    return queryRestaurants(station, distance)

def queryRestaurants(station, distance):
    query= f"""
    SELECT * 
    FROM planet_osm_polygon pop 
    WHERE amenity in ('bar','bbq','biergarten','cafe','fast_food','food_court','ice_cream','pub','restaurant')
        AND
    ST_Distance(Geography(ST_Transform(pop.way ,4326)), '{station}') < '{distance}'
    """
    return execQuery(query)

#####################################################################################
######################## API for Route Planning #####################################
#####################################################################################

ors_api_url = 'http://ors-app:8080/ors/v2/'

@app.route('/route', methods=['POST'])
def getRoute():
    
    # temporarily default params for ors
    profile = 'driving-car'
    
    # request data from ors-app
    url = f'{ors_api_url}directions/{profile}/geojson'
    #TODO: handle exception
    req = requests.post(url, json=request.json)    
    
    #TODO: properly organize response
    return req.json(), 200

@app.route('/isochrones', methods=['POST'])
def getIsochrones():

    # temporarily default params for ors
    profile = 'driving-car'
    location_type = 'start' # start or destination
    range_type = 'distance' # distance (meters) or time (seconds)
    
    # request data from ors-app
    url = f'{ors_api_url}isochrones/{profile}/'
    ors_params = request.json
    ors_params['location_type'] = location_type
    ors_params['range_type'] = range_type
    req = requests.post(url, json=ors_params)

    return req.json(), 200

@app.route('/amenities', methods=['POST'])
def getAmenities():
    pass

@app.route('/charge-stations', methods=['POST'])
def getChargeStations():
    pass

@app.route('/charge-station-score', methods=['POST'])
def getScoreOfChargeStation():
    pass
