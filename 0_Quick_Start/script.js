Redwood.controller('SubjectCtrl', ['$rootScope', '$scope', 'RedwoodSubject', 'SynchronizedStopWatch', function($rootScope, $scope, rs, stopwatch) {
	rs.on_load(function() {
/*	========================================================================
		Redwood Setup
	======================================================================== */
		
		// Configs
		$.extend($scope, rs.config);
		$scope.round = 0; $scope.rounds = $scope.config.rounds || 1;
		rs.trigger('next_round');
		
		// Timer, rounds, periods
		var checkTime = function() {
			$scope.timeRemaining = 0;
			$scope.stopwatch = stopwatch.instance()
				.frequency(1)
				.duration($scope.roundDuration)
				.onTick(function(tick, t) {
					$scope.timeRemaining = $scope.timeTotal - t;
				})
				.onComplete(function() {
					$scope.timeRemaining = 0;
					$scope.roundStartTime = null;
					rs.trigger('next_round');
				}).start();
			$scope.timeTotal = $scope.stopwatch.getDurationInTicks();
		};
		rs.on('next_period', function() { rs.next_period(); });
		rs.on('next_round', function () {
			if ($scope.rounds && $scope.round >= $scope.rounds) { rs.trigger('next_period'); return; }
			$scope.round++;
			rs.synchronizationBarrier('round-' + $scope.round).then(function() {
				$scope.roundStartTime = (new Date()).getTime() / 1000;
				rs.trigger('roundStartTime', $scope.roundStartTime);
				checkTime();
			});
		});
		rs.recv('next_round', function() {
			if ($scope.roundStartTime) {
				$scope.roundStartTime = null;
				rs.trigger('next_round');
			}
		});
		rs.on('roundStartTime', function(roundStartTime) {
			$scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
		});
		rs.recv('roundStartTime', function(sender, roundStartTime) {
			$scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
		});
		
/*	========================================================================
		Your Code
	======================================================================== */
	
	
	});
}]);

