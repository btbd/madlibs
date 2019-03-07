(function(document) {
var canvas      = document.getElementById("canvas"),
	ctx         = canvas.getContext("2d", { alpha: false }),
	base        = new Node("", "https://raw.githubusercontent.com/cncf/artwork/master/cloudevents/icon/color/cloudevents-icon-color-reversed.png"),
	nodes       = [],
	words       = [],
	blank_words = 0,
	sentences   = [],
	done        = false;
	
var ctx_arc = ctx.arc;
ctx.arc = function() {
	arguments[0] = ~~(arguments[0] + 0.5);
	arguments[1] = ~~(arguments[1] + 0.5);
	return ctx_arc.apply(this, arguments);
};

var ctx_drawImage = ctx.drawImage;
ctx.drawImage = function() {
	arguments[1] = ~~(arguments[1] + 0.5);
	arguments[2] = ~~(arguments[2] + 0.5);
	return ctx_drawImage.apply(this, arguments);
};

var ctx_fillText = ctx.fillText;
ctx.fillText = function() {
	arguments[1] = ~~(arguments[1] + 0.5);
	arguments[2] = ~~(arguments[2] + 0.5);
	return ctx_fillText.apply(this, arguments);
};

if (!window.devicePixelRatio) window.devicePixelRatio = 1;
ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
	
var e_help          = document.getElementById("help"), 
	e_help_minimize = document.getElementById("help-minimize"),
	e_event         = document.getElementById("event"),
	e_event_close   = document.getElementById("event-close");

function Node(service, href) {
	this.service = service;
	this.text = "";
	this.status = 0;
	this.words = [];
	this.time = 0;
	this.img = null;
	this.href = href;
	this.draw = function(x, y, r) {
		if (this.img && this.img.complete) {
			var w = r * 2;
			var h = (this.img.height / this.img.width) * w;
				
			ctx.fillStyle = "white";
			ctx.beginPath();
			ctx.arc(x, y, r, 0, 2 * Math.PI);
			ctx.closePath();
			ctx.fill();
				
			ctx.save();
			ctx.beginPath();
			ctx.arc(x, y, r, 0, 2 * Math.PI);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(this.img, x - (w / 2), y - (h / 2), w, h);
			ctx.beginPath();
			ctx.arc(x, y, r, 0, 2 * Math.PI);
			ctx.clip();
			ctx.closePath();
			ctx.restore();
		} else {
			ctx.fillStyle = "white";
			ctx.beginPath();
			ctx.arc(x, y, r, 0, 2 * Math.PI);
			ctx.closePath();
			ctx.fill();
		}
	};
	this.emitter = new Emitter();
	
	if (this.href) {
		this.img = new Image();
		this.img.src = this.href;
	}
}

function Emitter() {
	this.particles = [];
	this.x = 0;
	this.y = 0;
	this.rate = 1; // how many updates before adding another particle
	this.spawn_size = 18 * window.devicePixelRatio;
	this.spawn_offset = 3 * window.devicePixelRatio;
	this.min = 2;
	this.max = 4;
	this.speed = 0.35;
	this.direction = 0;
	this.range = Math.PI / 8;
	this.updates = 0;
	this.color = "255,255,255";
	this.decay = 0.075;
	this.update = function() {
		var dest = 0;
		for (var i = 0; i < this.particles.length; ++i) {
			var particle = this.particles[i];
			
			particle.x += particle.vx;
			particle.y += particle.vy;
			particle.opacity -= this.decay;
				
			if (particle.opacity > 0) {
				ctx.beginPath();
				ctx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
				ctx.closePath();
				ctx.fillStyle = "rgba(" + particle.color + "," + particle.opacity + ")";
				ctx.fill();
			
				this.particles[dest++] = particle;
			}
		}
		this.particles.length = dest;
		
		if (this.updates % this.rate === 0) {
			for (var i = 0; i < this.spawn_size; i += this.spawn_offset) {
				var vx = Math.cos((Math.random() * (this.range * 2)) - this.range + this.direction) * this.speed;
				var vy = Math.sin((Math.random() * (this.range * 2)) - this.range + this.direction) * this.speed;
				
				this.particles.push({
					x: this.x + (vx * i) / this.speed + ((0.5 - Math.random()) * 2.5),
					y: this.y + (vy * i) / this.speed + ((0.5 - Math.random()) * 2.5),
					vx: vx,
					vy: vy,
					size: Math.random() * (this.max - this.min) + this.min,
					opacity: 1,
					color: this.color
				});
			}
		}

		++this.updates;
	}
}

function update() {
	var radius = (Math.min(canvas.width, canvas.height - (canvas.height * 0.2)) / 2) * 0.8,
		fs     = radius * 0.06,
		cx     = canvas.width / 2,
		cy     = (1.1 * canvas.height) / 2;
		
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	if (!done) ctx.font = fs + "px IBM Plex Sans";
		
	for (var i = 0, angle = -Math.PI / 2, inc = (2 * Math.PI) / nodes.length; i < nodes.length; ++i, angle += inc) {
		var rx = Math.cos(angle) * 1.2,
			ry = Math.sin(angle);

		if (nodes[i].time < nodes[i].status) {
			nodes[i].emitter.rate = 1;
			nodes[i].time += 0.06;
			if (nodes[i].time >= 2) {
				nodes[i].time = 0;
				nodes[i].status = 0;
				
				if (nodes[i].words.length !== blank_words) nodes[i].status = 1;
				
				var c = 0;
				for (; c < nodes.length; ++c) {
					if (nodes[c].time !== 0 || nodes[c].status !== 0 || nodes[c].words.length !== blank_words) {
						break;
					}
				}
				
				if (c === nodes.length) {
					finish();
				}
			} else if (nodes[i].time >= 1 && nodes[i].status === 1) {
				function request(node) {
					var type = "";
					for (var i = 0, e = 0; i < words.length; ++i) {
						if (words[i].blank && node.words.length === e++) {
							type = words[i].value;
							break;
						}
					}
					
					httpGet("./word?w=" + type + "&u=" + encodeURIComponent(node.service), function(x) {
						if (x.readyState === 4 && x.status === 200) {
							var data = JSON.parse(x.responseText);
							var word = new String(data.word);
							word.request = data.request;
							word.response = data.response;
							node.words.push(word);
							node.status = 2;
						}
					});
				}
					
				if (nodes[i].words.length === 0) {
					window.last_timeout = setTimeout(request.bind(this, nodes[i]), Math.random() * 500);
				} else {
					request(nodes[i]);
				}
			}

			var r = nodes[i].time < 1 ? nodes[i].time : (2 - nodes[i].time);
			r *= radius;
			
			var emitter = nodes[i].emitter;
			emitter.speed = (radius / 275) * 0.35 / window.devicePixelRatio;
			emitter.min = radius * 0.01;
			emitter.max = radius * 0.02;
			emitter.direction = nodes[i].time < 1 ? angle : angle + Math.PI;
			emitter.range = (radius / 550) * Math.PI / 8 / window.devicePixelRatio;
			emitter.x = cx + (rx * r);
			emitter.y = cy + (ry * r);
			emitter.color = nodes[i].time < 1 ? "177,177,177" : "255,255,255";
			
			emitter.update();
		} else {
			nodes[i].emitter.rate = 0;
			if (nodes[i].emitter.particles.length > 0) {
				nodes[i].emitter.update();
			}
		}
		
		if (nodes[i].words.length > 0) {
			var r  = radius * 0.225,
				oy = ((blank_words - 1) * fs) / 2,
				ox = angle > Math.PI / 2 ? -r : r;
			
			ctx.textAlign = angle > Math.PI / 2 ? "right" : "left";
			
			if (!done) {
				ctx.fillStyle = "white";
				
				if (nodes[i].status === 2) {	
					var e = 0;
					for (; e < nodes[i].words.length - 1; ++e) {
						ctx.fillText(nodes[i].words[e], ox + cx + rx * radius, e * fs - oy + cy + ry * radius);
					}
					
					var o = 1 - Math.pow(-nodes[i].time + 2, 2);
					ctx.fillStyle = "rgba(255,255,255," + o + ")";
					ctx.fillText(nodes[i].words[e], (ox * o) + cx + rx * radius, e * fs - oy + cy + ry * radius);
				} else {
					for (var e = 0; e < nodes[i].words.length; ++e) {
						ctx.fillText(nodes[i].words[e], ox + cx + rx * radius, e * fs - oy + cy + ry * radius);
					}
				}
			} else {
				var last = null;
				for (var e = 0; e < nodes[i].words.length; ++e) {
					var p = nodes[i].words[e].picked;
					if (p !== last) {
						if (p) {
							ctx.font = "600 " + fs + "px IBM Plex Sans";
							ctx.fillStyle = "red";
							ctx.shadowColor = "red";
							ctx.shadowBlur = 40;
						} else {
							ctx.font = fs + "px IBM Plex Sans";
							ctx.fillStyle = "white";
							ctx.shadowColor = "";
							ctx.shadowBlur = 0;
						}
					}
				
					ctx.fillText(nodes[i].words[e], ox + cx + rx * radius, e * fs - oy + cy + ry * radius);	
					last = p;
				}
				ctx.shadowColor = "";
				ctx.shadowBlur = 0;
			}	
		}

		nodes[i].draw(cx + (rx * radius), cy + (ry * radius), radius * 0.2);
	}
	
	base.draw(cx, cy, radius * 0.2);
	
	requestAnimationFrame(update);
}

function httpGet(url, state) {
	var x = new XMLHttpRequest();
	x.onreadystatechange = function() {
		state(x);
	};
	x.open("GET", url, true);
	x.send(null);
}

function updateSettings(callback) {
	httpGet("./settings", function(x) {
		if (x.readyState === 4 && x.status === 200 && x.responseText.length > 0) {
			var settings = JSON.parse(x.responseText);
			if (settings.sentences && settings.sentences.length > 0 && settings.nodes && settings.nodes.length > 0) {
				words = [];
				blank_words = 0;
	
				var changed = settings.sentences.length !== sentences.length;
				if (!changed) {
					var i = 0;
					for (; i < settings.sentences.length && sentences.indexOf(settings.sentences[i]) !== -1; ++i);
					
					changed = i !== sentences.length;
				}
				
				if (changed) {
					sentences = settings.sentences;
					
					for (var i = sentences.length - 1; i > 0; --i) {
						var j = Math.floor(Math.random() * (i + 1)),
							t = sentences[i];
							
						sentences[i] = sentences[j];
						sentences[j] = t;
					}
				}
				
				if (!sentences.next || sentences.next >= sentences.length) sentences.next = 0;
				var sentence = sentences[sentences.next];
				
				for (var w = sentence.split(" "), i = 0; i < w.length; ++i) {
					w[i] = w[i].trim();
					if (w[i].length > 0) {
						var e = 0;
						for (; e < w[i].length && (/[A-Z]/).test(w[i][e]); ++e);
						
						if (e > 1) {
							++blank_words;
							words.push({ value: w[i].slice(0,e), blank: true });
							if (e < w[i].length) {
								words.push({ value: w[i].slice(e), punctuation: true });	
							}
						} else {
							words.push({ value: w[i] });
						}
					}
				}
				
				if (blank_words > 0) {
					nodes = [];
					for (var i = 0; i < settings.nodes.length; ++i) {
						if (!settings.nodes[i].disabled) {
							nodes.push(new Node(settings.nodes[i].service, settings.nodes[i].img));
						}
					}
				}
			}
			
			callback();
		}
	});
}

function reset(callback) {
	done = false;
	
	while (window.last_timeout) {
		clearTimeout(window.last_timeout--);
	}
	
	holder.innerHTML = "";
	holder.classList.remove("holder-show");
	holder.classList.add("holder-hide");
	
	ctx.textBaseline = "middle";
	
	for (var i = 0; i < nodes.length; ++i) {
		nodes[i].text = "";
		nodes[i].status = nodes[i].time = 0;
		nodes[i].words.length = nodes[i].emitter.particles.length = 0;
	}
	
	updateSettings(function() {
		if (blank_words > 0 && callback) {
			++sentences.next;
			callback();
		}
	});
}

function finish() {
	window.stop();
	done = true;
	holder.innerHTML = "";
	for (var i = 0, e = 0; i < words.length; ++i) {
		if (!words[i].punctuation) {
			holder.innerHTML += " ";
		}
		
		if (words[i].blank) {
			var values = [];
			for (var r = 0; r < nodes.length; ++r) {
				if (nodes[r].words[e].toLowerCase() !== "failure") values.push(nodes[r].words[e]);
			}
			
			++e;
			var word = values.length === 0 ? "FAILURE" : values[Math.floor(Math.random() * values.length)];
			
			var type = words[i].value;
			word.picked = true;
			words[i].value = word;
			holder.innerHTML += '<div class="blank" title="' + type + '">' + words[i].value + '</div>';
		} else {
			holder.innerHTML += '<div class="word">' + words[i].value + '</div>';
		}
	}
	
	holder.classList.remove("holder-hide");
	holder.classList.add("holder-show");
}

function setStyle(element, style, value) {
    if (element.style.setAttribute) {
		element.style.setAttribute(style, value);
    } else {
		element.style[style] = value;
    }
}

function resize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	
	if (window.devicePixelRatio > 1) {
		var w = canvas.width;
		var h = canvas.height;
		canvas.width *= window.devicePixelRatio;
		canvas.height *= window.devicePixelRatio;
		setStyle(canvas, "width", w + "px");
		setStyle(canvas, "height", h + "px");
	}
	
	// Using transform and % positioning causes blurry text on Chrome
	var w = window.innerWidth * 0.75;
	var h = window.innerHeight * 0.90;
	help.classList.add("disable-transition");
	setStyle(e_help, "width", w + "px");
	setStyle(e_help, "height", h + "px");
	setStyle(e_help, "left", (window.innerWidth / 2 - w / 2) + "px");
	setStyle(e_help, "top", (window.innerHeight / 2 - h / 2) + "px");
}

function start() {
	for (var i = 0; i < nodes.length; ++i) nodes[i].status = 1;
}

function formatRequest(s) {
	var i = s.indexOf("{")
	if (i === -1) return s;
	
	return s.slice(0, i) + JSON.stringify(JSON.parse(s.slice(i)), null, 2);
}

function inNode(x, y, cx, cy) {
	return Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2)) <= (Math.min(canvas.width, canvas.height - (canvas.height * 0.2)) / 2) * 0.8 * 0.2;
}

function nodeHandler(x, y) {
	x *= window.devicePixelRatio;
	y *= window.devicePixelRatio;
	
	if (e_help_minimize.innerText !== "—" && e_event.classList.contains("hide")) {
		var radius = (Math.min(canvas.width, canvas.height - (canvas.height * 0.2)) / 2) * 0.8,
			cx     = canvas.width / 2,
			cy     = (1.1 * canvas.height) / 2;
		
		if (inNode(x, y, cx, cy)) {
			reset(start);
			return;
		}
		
		for (var i = 0, angle = -Math.PI / 2, inc = (2 * Math.PI) / nodes.length; i < nodes.length; ++i, angle += inc) {
			var rx = Math.cos(angle) * 1.2,
				ry = Math.sin(angle);
			
			if (inNode(x, y, cx + (rx * radius), cy + (ry * radius)) && nodes[i].words.length > 0) {
				var n = nodes[i];
				e_event.classList.toggle("hide");
				document.getElementById("request").innerHTML = formatRequest(n.words[n.words.length - 1].request);
				document.getElementById("response").innerHTML = formatRequest(n.words[n.words.length - 1].response);
				return;
			}
		}
	}
}

canvas.onclick = function() {
	e_help.classList.add("help-minimized");
	help.classList.remove("disable-transition");
	e_help_minimize.innerText = "?";
	e_event_close.onclick();
};

e_event_close.onclick = function() {
	e_event.classList.add("hide");
};

e_help_minimize.onclick = function() {
	var help = e_help;
	
	if (this.innerText === "—") {
		this.innerText = "?";
		help.classList.add("help-minimized");
		help.classList.remove("disable-transition");
	} else {
		this.innerText = "—";
		help.classList.remove("help-minimized");
		help.classList.remove("disable-transition");
	}
};

window.addEventListener("resize", resize);

window.addEventListener("mousedown", function(e) {
	nodeHandler(e.clientX, e.clientY);
});

window.addEventListener("keydown", function(e) {
	switch (e.keyCode) {
		case 27:
			canvas.onclick();
			break;
		case 32:
			reset(start);
			break;
		case 83:
			updateSettings(function() {
				holder.innerHTML = "";
				for (var i = 0; i < words.length; ++i) {
					if (!words[i].punctuation) {
						holder.innerHTML += " ";
					}
					
					if (words[i].blank) {
						holder.innerHTML += '<div class="blank" title="' + words[i].value + '">' + words[i].value + '</div>';
					} else {
						holder.innerHTML += '<div class="word">' + words[i].value + '</div>';
					}
				}
				holder.classList.remove("holder-hide");
				holder.classList.add("holder-show");
			});
			break;
	}
});

window.addEventListener("touchstart", function(e) {
	for (var i = 0; i < e.targetTouches.length; ++i) {
		if (nodeHandler(e.targetTouches[i].clientX, e.targetTouches[i].clientY)) return;
	}
});

(function main() {
	resize();
	update();

	reset();
})();

Function.prototype.bind = function(parent) {
    var f    = this,
	    args = [];

    for (var i = 0, a = 1; a < arguments.length; ++a, ++i) {
        args[i] = arguments[a];
    }

    return function() {
        return f.apply(parent, args);
    };
};

})(document);