(function() {
	"use strict";

	angular.module('offersApp', [ 'ionic' ])

	.controller('offerListController', function(offerFactory, userFactory, messageHandler, $scope, $state) {
		$scope.searchOffers = function(searchString) {
			offerFactory.getOffers(searchString).then(function(response) {
				$scope.offers = response.data;
			}, function(response) {
				messageHandler.showStatus("Error retrieving offers : " + response.statusText + " - " + response.data.error, false);
				$scope.offers = [];
			});
		};
		$scope.setUser = function() {
			var promise = userFactory.me();
			promise.then(function(response) {
				$scope.user = response.data;
			}, function(response) {
				messageHandler.showStatus("Error retrieving user info : " + response.statusText + " - " + response.data.error, false);
				$scope.user = {};
			});
		};
		$scope.editOffer = function(id) {
			$state.go('offers.edit', {
				id : id
			});
		};
		$scope.createOffer = function() {
			$state.go('offers.new');
		};
		$scope.setUser();
		$scope.searchOffers();
	})

	.controller('offerEditController', function(offerFactory, userFactory, messageHandler, $scope, $stateParams, $state) {
		$scope.getOffer = function(id) {
			var promise = offerFactory.getOffer(id);
			promise.then(function(response) {
				$scope.offer = response.data;
			}, function(response) {
				messageHandler.showStatus("Error retrieving offer : " + response.statusText + " - " + response.data.error, false);
				$scope.offer = {};
			});
		};
		$scope.submitOffer = function() {
			var promise = offerFactory.saveOffer($scope.offer);
			promise.then(function(response) {
				messageHandler.showStatus("Offer updated! : " + response.data.id, true);
				$scope.back();
			}, function(response) {
				messageHandler.showStatus("Error! updating offer : " + response.statusText + " - " + response.data.error, false);
			});
		};
		$scope.deleteOffer = function() {
			var promise = offerFactory.deleteOffer(id);
			promise.then(function(response) {
				messageHandler.showStatus("Offer deleted!", true);
				$scope.back();
			}, function(response) {
				messageHandler.showStatus("Error! deleting offer : " + response.statusText + " - " + response.data.error, false);
			});
		};
		$scope.setUser = function() {
			var promise = userFactory.me();
			promise.then(function(response) {
				$scope.offer.user = response.data;
			}, function(response) {
				messageHandler.showStatus("Error retrieving user info : " + response.statusText + " - " + response.data.error, false);
				$scope.offer.user = {};
			});
		};
		$scope.back = function() {
			$state.go('offers.index');
		};
		var id = $stateParams.id;
		if (id) {
			$scope.getOffer(id);
		} else {
			$scope.offer = {};
			$scope.setUser();
		}
	})

	.factory('offerFactory', function(httpRequest) {
		return {
			getOffers : function(searchString) {
				var config = {
					method : 'GET',
					url : '/offers' + (angular.isDefined(searchString) ? '?search=' + searchString : '')
				}
				return httpRequest.send(config);
			},
			getOffer : function(id) {
				var config = {
					method : 'GET',
					url : '/offers/' + id
				}
				return httpRequest.send(config);
			},
			saveOffer : function(offer) {
				var config = {};
				if (angular.isDefined(offer.id)) {
					config = {
						method : 'PUT',
						url : '/offers/' + offer.id,
						data : offer
					}
				} else {
					config = {
						method : 'POST',
						url : '/offers',
						data : offer
					}
				}
				return httpRequest.send(config);
			},
			deleteOffer : function(id) {
				var config = {
					method : 'DELETE',
					url : '/offers/' + id
				}
				return httpRequest.send(config);
			}
		}
	})

	.factory('userFactory', function(httpRequest) {
		return {
			me : function() {
				var config = {
					method : 'GET',
					url : '/me'
				}
				return httpRequest.send(config);
			}
		}
	})

	.factory('httpRequest', function(authenticationFactory, urlBuilder, $q, $http) {
		var access_token = null;
		var retryWithNewToken = function(config, deferred) {
			access_token = authenticationFactory.refreshToken();
			access_token.then(function(token) {
				config.headers.access_token = token;
				$http(config).then(function successCallback(response) {
					deferred.resolve(response);
				}, function errorCallback(response) {
					deferred.reject(response);
				});
			});
		}
		return {
			send : function(options) {
				var deferred = $q.defer();
				if (!access_token) {
					access_token = authenticationFactory.getToken();
				}
				access_token.then(function(token) {
					$http({
						method : options.method,
						url : urlBuilder.buildRestEndPoint(options.url),
						headers : {
							'access_token' : token
						},
						data : options.data || {}
					}).then(function successCallback(response) {
						deferred.resolve(response);
					}, function errorCallback(response) {
						if (response.status == 401) {
							retryWithNewToken(response.config, deferred);
						} else {
							deferred.reject(response);
						}
					});
				});
				return deferred.promise;
			}
		};
	})

	.factory('authenticationFactory', function(tokenFactory, urlBuilder, $q, $http) {
		var sendTokenRequest = function() {
			var deferred = $q.defer();
			$http({
				method : 'GET',
				url : urlBuilder.buildRestEndPoint('/login')
			}).then(function successCallback(response) {
				deferred.resolve(response);
			}, function errorCallback(response) {
				deferred.reject();
			});
			return deferred.promise;
		};
		return {
			getToken : function() {
				var deferred = $q.defer();
				if (!tokenFactory.isExpired()) {
					deferred.resolve(tokenFactory.getToken());
				} else {
					deferred.resolve(this.refreshToken());
				}
				return deferred.promise;
			},
			refreshToken : function() {
				var deferred = $q.defer();
				sendTokenRequest().then(function(response) {
					tokenFactory.saveToken(response.data.access_token);
					deferred.resolve(response.data.access_token);
				}, function errorCallback(response) {
					deferred.reject();
				});
				return deferred.promise;
			}
		}
	})

	.factory('tokenFactory', function() {
		return {
			isExpired : function() {
				return (this.getToken() == '');
			},
			getToken : function() {
				return window.localStorage.getItem('access_token');
			},
			saveToken : function(access_token) {
				window.localStorage.setItem('access_token', access_token);
			}
		}
	})

	.factory('urlBuilder', function($q, $http) {
		return {
			buildRestEndPoint : function(url) {
				return 'http://ec2-52-36-107-201.us-west-2.compute.amazonaws.com:8080/WebSpringAngular/rest/v1' + url;
			}
		}
	})

	.factory('messageHandler', function($q, $http) {
		return {
			showStatus : function(message, isSuccess) {
				alert(message);
			}
		}
	})

	.filter('strLimit', function($filter) {
		return function(input, limit) {
			if (!input) {
				return;
			}
			if (input.length <= limit) {
				return input;
			}
			return $filter('limitTo')(input, limit) + '...';
		};
	})

	.config(function($httpProvider, $stateProvider, $urlRouterProvider) {
		// Enable cross domain calls
		$httpProvider.defaults.useXDomain = true;
		delete $httpProvider.defaults.headers.common['X-Requested-With'];

		$stateProvider.state('offers', {
			abstract : true,
			url : '/offers',
			views : {
				offers : {
					template : '<ion-nav-view></ion-nav-view>'
				}
			}
		})

		$stateProvider.state('offers.index', {
			url : '/',
			templateUrl : './templates/offerlist.html'
		})

		$stateProvider.state('offers.edit', {
			url : '/edit/:id',
			templateUrl : './templates/offeredit.html'
		})

		$stateProvider.state('offers.new', {
			url : '/new',
			templateUrl : './templates/offeredit.html'
		})

		$urlRouterProvider.otherwise("/offers/");

	})

	.run(function($ionicPlatform) {
		$ionicPlatform.ready(function() {
			if (window.cordova && window.cordova.plugins.Keyboard) {
				// Hide the accessory bar by default (remove this to show the
				// accessory bar above the keyboard
				// for form inputs)
				cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

				// Don't remove this line unless you know what you are doing. It
				// stops the viewport
				// from snapping when text inputs are focused. Ionic handles
				// this
				// internally for
				// a much nicer keyboard experience.
				cordova.plugins.Keyboard.disableScroll(true);
			}
			if (window.StatusBar) {
				StatusBar.styleDefault();
			}
		});
	})
})();
