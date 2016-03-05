$(function() {

    var r = new Redwood();
    
    function TimeKeeper () {
        
    }
    
    TimeKeeper.prototype = {
    
        /* >> SETUP << */
        
        setup : function () {
			this.refreshVariables();
            this.setReceive(this);
            this.setConfigData();
            this.generatePlayerID();
            if (this.playerID == 1) this.setTick(this);
        },
		refreshVariables : function () {
			// State
			this.state = 'INIT';
			this.roundOverOutcome = 'random';
			
			// Player Info
			this.playerID = 0;
			this.playerScore = 0;
			this.totalNumOfPlayer = 0;
			this.numOfPlayersWhoSold = 0;
			this.soldBeforeYou = 0;
			this.playersWhoSold = [];
			
			// Tick Setup
			this.currentTick = 0;
			this.tickSpeedInMs = 200;
			this.roundDurationInTicks = 50;
			this.circuitBreakerTime = 10000;
			this.orderClearingTime = 3000;
			
			// Events
			this.numOfFreezes = 0;
			this.maxNumOfFreezes = 1;
			this.tickEvents = [];
			this.eventProbabilities = [];
			this.marketPrices = [];
			this.marketPlaceIndex = 0;
			this.paidOutAward = 20;
			this.playerSold = false;
			this.playerPaidOut = false;
			this.playerClearing = false;
			this.active = false;
			
			// Plot
			this.opt = {
				series : { shadowSize : 0 },
				yaxis : { min : 0, max : 12, labelWidth : 30 },
				xaxis : { min : 0, max : 250, show : false },
				legend : { noColumns : 1, position : "nw", margin : [+8, -20], backgroundColor : null, backgroundOpacity : 0 },
				grid : { aboveData : true, markings : [{ yaxis : { from : 0, to : 0 }, color : "rgb(0,0,0)" }] }
			};
			this.data = [];
			this.animation = null;
		},
        generatePlayerID : function () {
            var iter = 1;
            for (var key in r.groups) {
                if (key === r.username)
                    this.playerID = iter;
                iter++;
                this.totalNumOfPlayer++;
            }
            //console.log('generated: (ID, numOfPlayers)', this.playerID, this.totalNumOfPlayer);
        },
        setConfigData : function () {
            r.send('config', {});
            //console.log('sent: config', {});
        },
        setTick : function (self) {
            self.active = setInterval(function () {
                r.send('advanceTick', {tick: self.currentTick+1, period: r.period});
                //console.log('sent: advanceTick', self.currentTick+1);
            }, self.tickSpeedInMs);
        },
        setCiruitBreaker : function () {
            r.send('activateCircuitBreaker', this.playerID);
            //console.log('sent: activateCircuitBreaker', {this.playerID});
            setTimeout(function () {
                r.send('resetCircuitBreaker', {});
                //console.log('sent: resetCircuitBreaker', {});
            }, this.circuitBreakerTime);
        },
        setOrderClearing : function () {
			$("#act").attr("disabled", "disabled");
            r.send('activateOrderClearingPhase', this.playerID);
        },
        setReceive : function (self) {
            //console.log('setting receive...');
            r.recv('config', function () {
                //console.log('received: config', r.config);
                self.roundDurationInTicks = r.config.tend;
                self.tickSpeedInMs = r.config.tick;
                self.circuitBreakerTime = r.config.breakTime * 1000;
                self.orderClearingTime = r.config.clearTime * 1000;
                if (r.config.s == "b") self.roundOverOutcome = "forcedSalesOnly";
                else if (r.config.s == "g") self.roundOverOutcome = "paidOutOnly";
                self.tickEvents = r.config.tickEvents;
                self.eventProbabilities = r.config.eventProbabilities;
                self.marketPrices = r.config.marketPrices;
                self.maxNumOfFreezes = r.config.maxNumOfFreezes == 'none' ? 0 : r.config.maxNumOfFreezes;
                self.paidOutAward = r.config.payoff;
                self.opt.yaxis.max = self.marketPrices[0] + 2;
                self.state = 'NORMAL';
                //console.log('received: config', self);
            });
            r.recv('advanceTick', function (msg) {
                //console.log('received: advanceTick');
                if (self.currentTick >= self.roundDurationInTicks && self.state == 'NORMAL') {
                    self.state = "WAIT";
                    $("#act").attr("disabled", "disabled");
                    if (self.playerID == 1) self.calculateResults();
                }
                self.currentTick = msg.Value.tick;
				if (msg.Value.period < r.period) r.send('resetPeriod', msg.Value.period);  
                switch (self.state) {
                    case 'INIT': console.log ('Initializing...'); break;
                    case 'WAIT': console.log ('Calculating result...'); break;
                    case 'NORMAL':
                        self.updatePlot();
                        self.updateTable();
                        break;
                    case 'ROUND_END':
                        self.displayResults();
                        break;
                }
            });
			r.recv('resetPeriod', function (msg) {
				r.set_period(msg.Value);
			});
            r.recv('activateOrderClearingPhase', function (msg) {
                $("#timeleft").show();
                if (self.playerID == msg.Value) timeleft.textContent = "You placed an order.";
                else timeleft.textContent = "Player " + msg.Value + " placed an order.";
                if (self.playerSold) { timeleft.textContent += " Your score : " + self.playerScore; return; }
                if (self.playerClearing) {
                    if (self.maxNumOfFreezes > self.numOfFreezes) self.setCiruitBreaker();
                } else {
                    if (msg.Value == self.playerID) {
                        if (self.maxNumOfFreezes >= self.numOfFreezes) self.playerClearing = true;
                        setTimeout(function () {
                            if (self.playerClearing) r.send('processOrder', self.playerID);
                        }, self.orderClearingTime);
                    }
                }
            });
            r.recv('processOrder', function (msg) {
                if (self.playerID == msg.Value) {
                    self.playerScore = self.marketPrices[self.marketPlaceIndex];
					r.set_points(self.playerScore, r.period, r.username);
                    timeleft.textContent = "Your score : " + self.playerScore;
                    self.playerSold = true; self.playerClearing = false;
                }
                self.marketPlaceIndex++;
                self.numOfPlayersWhoSold++;
                if (self.playerID != msg.Value && !self.playerSold) self.soldBeforeYou++;
                self.playersWhoSold[msg.Value] = true;
                if (self.numOfPlayersWhoSold != self.totalNumOfPlayer && self.playerSold == false && self.playerClearing == false) $("#act").removeAttr('disabled');
            });
            r.recv('activateCircuitBreaker', function (msg) {
                //console.log('received: activateCircuitBreaker');
                self.playerClearing = false;
                self.numOfFreezes++;
                $("#act").attr("disabled", "disabled");
                $(".alert-error").text("The market is locked, please wait until it is unlocked.");
                $(".container").addClass("error");
                $(".alert-error").show();
            });
            r.recv('resetCircuitBreaker', function () {
                //console.log('received: resetCircuitBreaker');
                if (self.state != "ROUND_END" && self.playerSold == false) $("#act").removeAttr('disabled');
                $("#timeleft").hide();
                $(".alert-error").hide();
            });
            r.recv('roundEnd', function (msg) {
                self.state = 'ROUND_END';
                if (msg.Value['playerID'] == self.playerID && self.playerScore == 0) {
                    console.log('received: roundEnd', msg.Value.playerScore);
                    self.playerScore = msg.Value['playerScore'];
					r.set_points(self.playerScore, r.period, r.username);
                }
                setTimeout(function () {
					if (self.active) clearInterval(self.active);
                    r.set_period(r.period + 1);
                }, 10000);
            });
            r.recv('paidOut', function () {
                self.playerPaidOut = true;
            });
            $("#act").click(function() {
                self.setOrderClearing();
            });
        },
        
        /* >> PLOT & TABLE << */
        
        setupAxes : function () {
            if (this.currentTick > 130 && this.currentTick > this.opt.xaxis.max - 130) {
                this.opt.xaxis.max = this.currentTick + 120;
                this.opt.xaxis.min = this.currentTick - 130;
            }
        },
        updatePlot : function () {
            var value = this.marketPrices[this.marketPlaceIndex] ? this.marketPrices[this.marketPlaceIndex] : 0;
            this.data.push([this.currentTick, value]);
            this.setupAxes();
            $.plot($("#plot2"), [{
                color : "rgb(238,44,44)",
                label : "Current price",
                data : this.data
            }], this.opt);
        },
        updateTable : function () {
            for (var i = 0; i < this.tickEvents.length; i++) {
                if (this.currentTick == this.tickEvents[i]) {
                    var display_temp = this.eventProbabilities[i];
                    $("#display_forced_sale").text((display_temp + "%"));
                    $("#display_payoout").text(((100 - display_temp) + "%"));
                    $("#probability_box").css('background', '#AAAAAA');
                    var tmp = setInterval(function() {
                        $("#probability_box").css('opacity', $("#probability_box").css('opacity') - 0.1);
                    }, 50);
                    setTimeout(function (tmp) {
                        $("#probability_box").css('background', '#FFFFFF');
                        $("#probability_box").css('opacity', 1);
                        clearInterval(tmp);
                    }, 500, tmp);
                    console.log('there is an update at t = ' + this.currentTick);
                    break;
                }
            }
        },
        
        /* >> RESULTS << */
        
        calculateResults : function () { var self = this;
            if (this.playerID == 1) {
                setTimeout(function() {
                    var scoreArray = self.marketPrices, numOfForcedSales = self.totalNumOfPlayer - self.numOfPlayersWhoSold;
					for (var i = 0; i < self.numOfPlayersWhoSold; i++) scoreArray.shift();
                    scoreArray = self.shuffleArray(scoreArray);
                    console.log('numOfForcedSales: '+numOfForcedSales, scoreArray);
                    for (var k = 0; k < self.totalNumOfPlayer; k++) {
                        if (self.playersWhoSold[k+1]) { r.send('roundEnd', { playerID: k+1 }); continue; }
                        if (self.roundOverOutcome == 'forcedSalesOnly') r.send('roundEnd', { playerID: k+1, playerScore: scoreArray[0] });
                        else if (self.roundOverOutcome == 'paidOutOnly' ) {
                            r.send('paidOut', { playerID: k+1 });
                            r.send('roundEnd', { playerID: k+1, playerScore: self.paidOutAward });
                        } else {
                            var draw = Math.random() * 100;
                            console.log('roundEnd: ', 'playerID = '+(k+1), 'draw = '+draw, 'odds of forced sale = '+self.eventProbabilities[self.eventProbabilities.length-1]);
                            if (draw <= self.eventProbabilities[self.eventProbabilities.length-1]) {
                                r.send('roundEnd', { playerID: k+1, playerScore: scoreArray[0] });
                            } else {
                                r.send('paidOut', { playerID: k+1 });
                                r.send('roundEnd', { playerID: k+1, playerScore: self.paidOutAward });
                            }
                        }
                        scoreArray.shift();
                        //console.log('sent: roundEnd', { playerID: k+1, playerScore: scoreArray[k] });
                    }
                    self.state = 'WAIT';
                }, this.orderClearingTime);
            }
        },
        displayResults : function () {
            $("#act").attr("disabled", "disabled");
            $(".container").addClass("error");
            $(".alert-error").show();
            if (r.config.s == 'b') {
              $(".alert-error").text("Round ends with a FORCED SALE.");
            } else if (r.config.s == 'g') {
              $(".alert-error").text("Round ends with a PAYOFF");
            }
            $("#timeleft").show();
            if (this.playerSold) {
                timeleft.textContent = "You sold before the end with a score of: " + this.playerScore + ". " +
                                       "Number of players who sold before you: " + this.soldBeforeYou + "."
            } else if (this.playerPaidOut) {
                timeleft.textContent = "You paid out in the end with a score of: "+ this.playerScore + ". " +
                                       "Number of players who sold before you: " + this.soldBeforeYou + "."
            } else {
                timeleft.textContent = "You were forced to sell at the end with a score of: "+ this.playerScore + ". "+
                                       "Number of players who sold before you: " + this.soldBeforeYou + "."
            }
        },
        shuffleArray : function (o) {
            for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x); return o;
        }
    };
    
    var timeKeeper = new TimeKeeper();
    
    r.finish_sync(function() {
        timeKeeper.setup();
    });
});