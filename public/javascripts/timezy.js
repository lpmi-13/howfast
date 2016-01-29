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
        { id: 'womens half', db: 'wo_half'},
        { id: 'womens marathon', db: 'wo_marathon'}
    ];

    var clearDivs = function () {
        $scope.hasHours = false;
        $scope.hasMinutes = false;
        $scope.hasSeconds = false;
        $scope.hasTenths = false;
        $scope.hours = null;
        $scope.minutes = null;
        $scope.seconds = null;
        $scope.tenths = null;
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
                $scope.hasTenths = true;
                break;
            case 'mo_800':
            case 'wo_800':
                $scope.hasMinutes = true;
                $scope.hasSeconds = true;
                $scope.hasTenths = true;
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

    $scope.check = function () {

        var hours = $scope.hours || 0;
        var minutes = $scope.minutes || 0;
        var seconds = $scope.seconds || 0;
        var tenths = $scope.tenths || 0;

        $scope.myTime = (hours * 3600) + (minutes * 60) +
          + seconds + (tenths/100);
        
        $scope.slowArray = [];

        $scope.events.map(function(s) {
            if (s.seconds > $scope.myTime) {
                $scope.slowArray.push({nationality : s.nationality, time : s.time, seconds : s.seconds});
            }
        });

        $scope.isChecked = true;
    }

    $scope.clear = function () {
        $scope.hours = 0;
        $scope.minutes = 0;
        $scope.seconds = 0;
        $scope.tenths = 0;
        $scope.isChecked = false;
    }
}]);