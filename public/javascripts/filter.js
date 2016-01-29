angular.module('lodashFilter', []).filter('unders', function() {
	return function(input) {
		return input.replace(/_/g, ' ');
	};
});