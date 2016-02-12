var app = angular.module('Howfast', ['ngResource', 'ngRoute', 'lodashFilter', 'ui.bootstrap', 'ngMessages']);

app.config(['$routeProvider', function($routeProvider){
    $routeProvider
        .when('/', {
            templateUrl: 'partials/home.html',
            controller : 'HomeCtrl'
        })
        .otherwise({
            redirectTo: '/'
        });
}]);

app.controller('HomeCtrl', ['$scope', '$http',
	function ($scope, $http) {

    $scope.choices = [
        { id: 'mens 100', db: 'mo_100'},
        { id: 'mens 200', db: 'mo_200'},
        { id: 'mens 400', db: 'mo_400'},
        { id: 'mens 800', db: 'mo_800'},
        { id: 'mens 1500', db: 'mo_1500'},
        { id: 'mens 5000', db: 'mo_5000'},
        { id: 'mens 10000', db: 'mo_10000'},
        { id: 'mens half marathon', db: 'mo_half'},
        { id: 'mens marathon', db: 'mo_marathon'},
        { id: 'womens 100', db: 'wo_100'},
        { id: 'womens 200', db: 'wo_200'},
        { id: 'womens 400', db: 'wo_400'},
        { id: 'womens 800', db: 'wo_800'},
        { id: 'womens 1500', db: 'wo_1500'},
        { id: 'womens 5000', db: 'wo_5000'},
        { id: 'womens 10000', db: 'wo_10000'},
        { id: 'womens half marathon', db: 'wo_half'},
        { id: 'womens marathon', db: 'wo_marathon'}
    ];

    var clearDivs = function () {
        $scope.hasHours = false;
        $scope.hasMinutes = false;
        $scope.hasSeconds = false;
        $scope.hasHundredths = false;
        $scope.hours = null;
        $scope.minutes = null;
        $scope.seconds = null;
        $scope.hundredths = null;
        $scope.isChecked = false;
    }

    $scope.isSelected = false;
    $scope.isChecked = false;
    $scope.myTime = 0;

    $scope.selectEvent = function () {
        clearDivs();
        $http.get('/api/times', {params: {db : $scope.distance.db }})
        .then(function(response){
            $scope.events = response.data;
            $scope.isSelected = true;   
            $scope.isChecked = false; 
        });

        switch ($scope.distance.db) {
            case 'mo_100':
            case 'mo_200':
            case 'mo_400':
            case 'wo_100':
            case 'wo_200':
            case 'wo_400':
                $scope.hasSeconds = true;
                $scope.hasHundredths = true;
                break;
            case 'mo_800':
            case 'wo_800':
                $scope.hasMinutes = true;
                $scope.hasSeconds = true;
                $scope.hasHundredths = true;
                break;
            case 'mo_1500':
            case 'mo_5000':
            case 'mo_10000':
            case 'wo_1500':
            case 'wo_5000':
            case 'wo_10000':
                $scope.hasMinutes = true;
                $scope.hasSeconds = true;
                break;
            case 'mo_half':
            case 'mo_marathon':
            case 'wo_half':
            case 'wo_marathon':
                $scope.hasHours = true;
                $scope.hasMinutes = true;
                $scope.hasSeconds = true;
                break;
        }
    }

    $scope.newConvertedArray = [];

    $scope.check = function () {

        var hours = $scope.hours || 0;
        var minutes = $scope.minutes || 0;
        var seconds = $scope.seconds || 0;
        var hundredths = $scope.hundredths || 0;

        $scope.myTime = (hours * 3600) + (minutes * 60) +
          + seconds + (hundredths/100);
        
        $scope.slowArray = [];
        $scope.mapArray = [];

        $scope.events.map(function(s) {
            if (s.seconds > $scope.myTime) {
                $scope.slowArray.push({country : s.country, nationality : s.nationality, time : s.time, seconds : s.seconds});
            }
        });
        console.log($scope.slowArray);

        // if ($scope.slowArray)
        $scope.isChecked = true;

        $scope.newConvertedArray = $scope.slowArray.map(function(t) {
            return t.country.replace("Great Britain and N.I.", "United Kingdom")
            .replace(/ /g, "_");
        });

        console.log($scope.newConvertedArray);

        $scope.newConvertedArray.forEach(function(x) {
            d3.select("#" + x + "")
                    .style("fill", "red" );
        });
        
        d3.select("#Somaliland")
                .style("fill", "black");
        d3.select("#Western_Sahara")
                .style("fill", "black");
        d3.select("#South_Sudan", "black")
                .style("fill", "black");
        d3.select("#Falkland_Islands", "black")
                .style("fill", "black");
        d3.select("#Former_South_Antarctic_Lands")
                .style("fill", "black");

    }

    $scope.clear = function () {
        $scope.hours = 0;
        $scope.minutes = 0;
        $scope.seconds = 0;
        $scope.hundredths = 0;
        $scope.isChecked = false;
    }

    var width = 1000;
    var height = 600;

    var projection = d3.geo.mercator()
        .center([0,35])
        .scale(175)
        .rotate([0,0]);

    var svg = d3.select(".map").append("svg")
                .attr("width", width)
                .attr("height", height);

    var path = d3.geo.path()
                .projection(projection);

    var g = svg.append("g");   

    d3.json("/topoJson/tworld.json", function(error, world) {
        if (error) return console.error(error);

        var data = world;

    //     for (var i = 0; i < topojson.object(world, world.objects.world).geometries.length; i++){
    //     console.log('country # ' + i + ' is ' + topojson.object(world, world.objects.world).geometries[i].properties.name);
    // }

        g.selectAll("path")
            .data(topojson.object(world, world.objects.world)
                .geometries)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("id", function(d) { return d.properties.name; });
        });

    //select path with id=value, path d fill

    
}]);