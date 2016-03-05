// State machine macros
var s = 0;
var STATES = {'INIT': s++,
			  'STOCHASTIC': {'SET': s++, 'PAUSE': s++}};
var FRAME_R = 50;

// Stochastic Class
function Stochastic () {
	this.user_in = 0;
	this.random_in = 0;
	this.profit = 0;
	this.time = 0;
	this.total_profit = 0;
	this.data = [];
	this.data_total = [];
	this.plot;
	this.state = STATES.STOCHASTIC.PAUSE;
	this.show_current = true;
	this.show_total = false;
}

// Stochastic class utilities
Stochastic.prototype = {
	constructor: Stochastic,
	start_process: function() {
		this.time_sec = new Date().getMinutes() * 60 + new Date().getSeconds();
		this.state = STATES.STOCHASTIC.SET;
	},
	pause_process: function() {
		this.state = STATES.STOCHASTIC.PAUSE;
	},
	reset_process: function() {
		this.user_in = 0;
		this.random_in = 0;
		this.total_profit = 0;
		this.profit = 0;
		this.time = 0;
		this.data = [];
		this.data_total = [];
	},
	toggle_random_value_visibility: function() {
		var val = document.getElementById("random_value");
		if(val.style.display == 'none') val.style.display = 'block';
		else val.style.display = 'none';
	},
	change_equation: function() {
		var result = document.getElementById('equation_input').value;
		var profit, user = this.get_user_in(), stoc = this.get_random_in();
		try {
			if (result == "") {
				alert("Please enter an equation");
				return;
			}
			eval(result);
			document.getElementById('equation').innerHTML = "PROFIT = " + result;
			this.reset_process();
		} catch (e) {
		        alert("Please use JavaScript to enter your equation!\n\n" +
		        	  "Error info:\n\t" +
		        	  e.message);
		}
	},
	get_random_in: function() {
		if (this.state == STATES.STOCHASTIC.SET)
			this.random_in = Math.random();
		else return 0;
		return this.random_in;
	},
	get_user_in: function() {
		this.user_in = Number(document.getElementById('user_in').value);
		return this.user_in.toFixed(2);
	},
	get_profit: function() {
		var user = this.user_in;
		var stoc = this.get_random_in();
		return eval(document.getElementById('equation').innerHTML);
	},
	get_total_profit: function() {
		return this.total_profit += this.get_profit();
	},
	display_user_in: function() {
		document.getElementById("user_in_val").innerHTML = "User Input: " + this.get_user_in();
	},
	display_random_in: function() {
		document.getElementById("random_value").innerHTML = "Stochastic Value: " + this.random_in.toFixed(2);
	},
	display_profit: function() {
		var tmp = this;
		setInterval(function() {
			var tmp_profit = tmp.get_profit().toFixed(2);
			if (tmp.data.length >= 50) tmp.data.shift();
			if (tmp.data_total.length >= 50) tmp.data_total.shift();
			tmp.data.push([tmp.time / 20, tmp_profit]);
			tmp.data_total.push([tmp.time++ / 20, tmp.total_profit]);
			document.getElementById("profit").innerHTML = "Profit Rate: " + tmp_profit;
		}, FRAME_R);
	},
	display_total_profit: function() {
		var tmp = this;
		setInterval(function() {
			document.getElementById("total_profit").innerHTML = "Accumulated Profit: " + tmp.get_total_profit().toFixed(2);
		}, FRAME_R);
	},
	make_chart: function() {
		this.plot = $.plot($('#profit_chart'), [
			{
				data:this.data,
				label: "Current Profit"
			},
			{
				data:this.data_total,
				label: "Total Profit"
			}]);
	},
	display_chart: function() {
		var tmp_data = [], tmp_total = [], label_1 = "", label_2 = "";
		if (this.show_current) {
			tmp_data = this.data;
			label_1 = "Current Profit";
		}
		if (this.show_total) {
			tmp_total = this.data_total;
			label_2 = "Total Profit";
		}
		this.plot.setData([
			{
				data: tmp_data,
				label: label_1,
			},
			{
				data: tmp_total,
				label: label_2
			}]);
		this.plot.setupGrid();
		this.plot.draw();
	},
	toggle_chart: function(toggle) {
		if (toggle) this.show_current = !this.show_current;
		else this.show_total = !this.show_total;
	}
};

// Init program loop
var page_state;
function loop() {
	if ( typeof loop != "undefined")
	clearInterval(loop);
	loop = setInterval(main, 30);
	page_state = STATES.INIT;
}
loop();

// Main
function main() {
	switch (page_state) {
		case STATES.INIT:
			process = new Stochastic();
			page_state = STATES.STOCHASTIC;
			process.make_chart();
			process.display_profit();
			process.display_total_profit();
			break;
		case STATES.STOCHASTIC:
			process.display_user_in();
			process.display_chart();
			process.display_random_in();
			break;
	}
}

