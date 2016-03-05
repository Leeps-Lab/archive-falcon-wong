Redwood.controller('SubjectCtrl', ['$rootScope', '$scope', 'RedwoodSubject', 'SynchronizedStopWatch', function($rootScope, $scope, rs, stopwatch) {

	rs.on_load(function() {
/*	========================================================================
		Program Variables
	======================================================================== */

		$.extend($scope, rs.config);
		for (var i in rs.config.grouping) {
			for (var j in rs.config.grouping[i]) {
				if (rs.config.grouping[i][j] == rs.user_id) {
					$scope.group = parseInt(i);
					$scope.index = parseInt(j);
					break;
				}
			}
		}
		$scope.state = 'NORMAL';
		$scope.opt = {
			yaxis : { min : 0, max : $scope.marketPrices[0] + 2 },
			xaxis : { min : 0, max : 25, show : false },
			grid : { markings: function (axes) {
				var markings = [], value = Math.floor(axes.xaxis.min);
				if (value % 2 == 0) value -= 1;
				for (var x = value; x <= axes.xaxis.max; x += 2)
					markings.push({ xaxis: { from: x, to: x + 1 } });
				return markings;
			} }
		};
		$scope.data = [];
		$scope.soldBeforeYou = 0;
		$scope.playersWhoSold = [];
		$scope.numOfTimesFrozen = 0;
		$scope.probability = 50;
		$scope.signalCount = {good: 0, bad: 0};
		if ($scope.convention == 'signal') $('.probability').hide();
		else $('.signal').hide();
		if ($scope.convention != 'signal' && $.isArray($scope.eventProbabilities))
			if ($.isArray($scope.eventProbabilities[$scope.group])) {
				if ($.isArray($scope.eventProbabilities[$scope.group][$scope.index]))
					$scope.events = $scope.eventProbabilities[$scope.group][$scope.index];
				else
					$scope.events = $scope.eventProbabilities[$scope.group];
			} else $scope.events = $scope.eventProbabilities;
		else if ($scope.convention == 'signal' && $.isArray($scope.eventSignals)) {
			if ($.isArray($scope.eventSignals[$scope.group])) {
				if ($.isArray($scope.eventSignals[$scope.group][$scope.index]))
					$scope.events = $scope.eventSignals[$scope.group][$scope.index];
				else
					$scope.events = $scope.eventSignals[$scope.group];
			} else $scope.events = $scope.eventSignals;
		}
		
/*	========================================================================
		Program Functions
	======================================================================== */
		
		$scope.sell = function () {
			rs.trigger('sell', {group: $scope.group});
		};
		$scope.setupAxes = function (t) {
            if (t > 20 && t > $scope.opt.xaxis.max - 20) {
                $scope.opt.xaxis.max = t + 5;
                $scope.opt.xaxis.min = t - 20;
            }
        };
		$scope.updatePlot = function (t) {
			var value = $scope.marketPrices[0] ? $scope.marketPrices[0] : 0;
			$scope.data.push([t, value]);
			$scope.setupAxes(t);
			$.plot($('#marketPlot'), [{
                label : 'Current price',
                data : $scope.data
            }], $scope.opt);
		};
		$scope.updateTable = function (t) {
			
			var tickEvents = $scope.tickEvents;
			if (tickEvents.length > 0 && t >= tickEvents[0]) {
				tickEvents.shift();
				if ($scope.convention == 'signal') {
					$scope.signal = $scope.events.shift() == 0 ?
									$scope.signal = '+Good (+'+
									(++$scope.signalCount.good) +
									' / -' + $scope.signalCount.bad + ')' :
									$scope.signal = '-Bad (+'+
									$scope.signalCount.good +
									' / -' + (++$scope.signalCount.bad) + ')';
					rs.trigger('update', {signal: $scope.signal});
				} else {
					$scope.probability = $scope.events.shift();
					rs.trigger('update', {probability: $scope.probability});
				}
				$('.probability, .signal')
					.animate({ opacity: 0.4 }, 250 )
					.animate({ opacity: 1 }, 250 );
			}
        };
		
/*	========================================================================
		Sending Messages
	======================================================================== */
		
		$scope.sell = function () {
			rs.trigger('orderPending', {group: $scope.group});
		};
		rs.on('orderPending', function (obj) {
			if ($scope.group != obj.group) return;
			$('#sell').attr('disabled', 'disabled');
			$('#msg').text('Message: Order pending...');
			if ($scope.immediateSale) {
				if ($scope.orderPending) rs.trigger('freezeMarket', {group: $scope.group});
				else rs.trigger('processOrder', {group: $scope.group, index: $scope.index});
			} else {
				setTimeout(function() {
					rs.trigger('processOrder', {group: $scope.group, index: $scope.index});
				}, $scope.clearTime * 1000);
			}
			$scope.orderPending = true;
		});
		rs.recv('orderPending', function (sender, obj) {
			if ($scope.group != obj.group) return;
			$('#msg').text('Message: Player '+sender+' placed an order');
			if ($scope.orderPending && $scope.maxNumOfFreezes != 'none' && $scope.numOfTimesFrozen < $scope.maxNumOfFreezes) rs.trigger('freezeMarket', {group: $scope.group});
		});
		rs.on('processOrder', function (obj) {
			if ($scope.group != obj.group) return;
			if ($scope.marketFrozen) return;
			$scope.playerScore = $scope.marketPrices.shift();
			if ($scope.immediateSale) {
				setTimeout(function() {
					$scope.orderPending = false;
				}, $scope.clearTime * 1000);
			} else $scope.orderPending = false;
			$scope.playersWhoSold[rs.user_id] = true;
			$('#yourStatus').text('sold');
			$('#msg').text('Message: You sold your share for $' + $scope.playerScore);
			$('#yourPayoff').text($scope.playerScore);
		});
		rs.recv('processOrder', function (sender, obj) {
			if ($scope.group != obj.group) return;
			if ($scope.marketFrozen) return;
			if (!$scope.playerScore) $scope.soldBeforeYou++;
			$scope.playersWhoSold[sender] = true;
			$('#msg').text('Message: Player '+(obj.index+1)+' sold her share for $' + $scope.marketPrices.shift());
		});
		rs.on('freezeMarket', function (obj) {
			if ($scope.group != obj.group) return;
			$scope.marketFrozen = true;
			$scope.numOfTimesFrozen++; 
			$('#sell').attr('disabled', 'disabled');
			$('#msg').text('Message: The market is locked!');
			$('#marketStatus').text('frozen');
			setTimeout(function() {
				rs.trigger('unfreezeMarket', {group: $scope.group});
			}, $scope.breakTime * 1000);
		});
		rs.recv('freezeMarket', function (sender, obj) {
			if ($scope.group != obj.group) return;
			$scope.marketFrozen = true;
			$scope.numOfTimesFrozen++; 
			$('#sell').attr('disabled', 'disabled');
			$('#msg').text('Message: The market is locked!');
			$('#marketStatus').text('frozen');
		});
		rs.on('unfreezeMarket', function (obj) {
			if ($scope.group != obj.group) return;
			$scope.marketFrozen = false;
			$scope.orderPending = false;
			$('#msg').text('Message: The market is freed.');
			$('#marketStatus').text('freed');
			if (!$scope.playersWhoSold[rs.user_id]) $("#sell").removeAttr('disabled');
		});
		rs.recv('unfreezeMarket', function (sender, obj) {
			if ($scope.group != obj.group) return;
			$scope.marketFrozen = false;
			$scope.orderPending = false;
			$('#msg').text('Message: The market is freed.');
			$('#marketStatus').text('freed');
			if (!$scope.playersWhoSold[rs.user_id]) $("#sell").removeAttr('disabled');
		});
		rs.on('forcedSales', function (obj) {
			if ($scope.group != obj.group || obj.player != rs.user_id) return;
			if ($scope.playerScore) {
				$('#msg').text('Forced Sales: You sold before the end for $' + $scope.playerScore + ' and ' + $scope.soldBeforeYou + ' players sold before you did.');
			} else {
				if (rs.user_id == obj.player) $scope.playerScore = obj.score;
				$('#msg').text('Forced Sales: You were forced to sell for $' + $scope.playerScore + ' and ' + $scope.soldBeforeYou + ' players sold before you did.');
			}
			$('#yourPayoff').text($scope.playerScore);
		});
		rs.recv('forcedSales', function (sender, obj) {
			if ($scope.group != obj.group || obj.player != rs.user_id) return;
			if ($scope.playerScore) {
				$('#msg').text('Forced Sales: You sold before the end for $' + $scope.playerScore + ' and ' + $scope.soldBeforeYou + ' players sold before you did.');
			} else {
				if (rs.user_id == obj.player) $scope.playerScore = obj.score;
				$('#msg').text('Forced Sales: You were forced to sell for $' + $scope.playerScore + ' and ' + $scope.soldBeforeYou + ' players sold before you did.');
			}
			$('#yourPayoff').text($scope.playerScore);
		});
		rs.on('payoff', function (obj) {
			if ($scope.group != obj.group) return;
			if ($scope.playerScore) {
				$('#msg').text('Payout: You sold before the end for $' + $scope.playerScore + ' and ' + $scope.soldBeforeYou + ' players sold before you did.');
			} else {
				$scope.playerScore = $scope.payoff ? $scope.payoff : 20;
				$('#msg').text('Payout: You waited for the payout of $' + $scope.playerScore + ' and ' + $scope.soldBeforeYou + ' players sold before you did.');
			}
			$('#yourPayoff').text($scope.playerScore);
		});
	
/*	========================================================================
		Redwood Setup
	======================================================================== */
		
		$scope.round = 0; $scope.rounds = $scope.config.rounds || 1;
		rs.trigger('next_round');
		
		// Timer, rounds, periods
		var freq = 1;
		var checkTime = function() {
			$scope.timeRemaining = 0;
			$scope.stopwatch = stopwatch.instance()
				.frequency(freq)
				.duration($scope.roundDuration + $scope.clearTime + 5)
				.onTick(function(tick, t) {
					// Program State machine
					$scope.timeRemaining = $scope.timeTotal - t;
					if ($scope.state == 'NORMAL') {
						var i = 0, fakeTick = setInterval(function () {
							$scope.updatePlot((new Date().getTime() - $scope.roundStartTime) /  1000);
							i++; if (i > 9) clearInterval(fakeTick);
						}, 100);
						$scope.updateTable(tick/freq);
					}
					if ($scope.timeRemaining <= 5 + $scope.clearTime && $scope.state == 'NORMAL') {
						$scope.state = 'WAIT';
						$('#sell').attr('disabled', 'disabled');
						$('#msg').text('Message: Ending soon ...');
						$('.box').css('background', 'red');
					}
					if ($scope.timeRemaining <= 5 && $scope.state == 'WAIT') {
						$scope.state = 'ENDED';
						if ($scope.outcome == 'forced' && rs.user_id == rs.config.grouping[$scope.group][0]) {
							var shuffleArray = function (o) { for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x); return o; }
							var group = rs.config.grouping[$scope.group];
							$scope.marketPrices = shuffleArray($scope.marketPrices.slice(0, group.length));
							for (var k = 0; k < group.length; k++) {
								var user = group[k];
								if ($scope.playersWhoSold[user]) rs.trigger('forcedSales', {player: user, group: $scope.group});
								else rs.trigger('forcedSales', {score: $scope.marketPrices.shift(), player: user, group: $scope.group});
							}
						} else if ($scope.outcome == 'payoff') {
							rs.trigger('payoff', {group: $scope.group});
						}
					}
				})
				.onComplete(function() {
					$scope.timeRemaining = 0;
					$scope.roundStartTime = null;
					rs.trigger('next_round');
				}).start();
			$scope.timeTotal = $scope.stopwatch.getDurationInTicks() / freq;
		};
		rs.on('next_period', function() { rs.add_points($scope.playerScore); rs.next_period(); });
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
	});
}]);

