(function (factory) {
    var localGlobal = typeof window === 'undefined' ? (typeof global === 'undefined' ? {} : global) : window;
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() : typeof define === 'function' && define.amd ? define(factory) : window.CoreAnimation = factory();
})(function () {
    'use strict'

    //fix
    var _requestAnimationFrame, _cancelAnimationFrame;
    if (typeof requestAnimationFrame) {
        _requestAnimationFrame = requestAnimationFrame;
        _cancelAnimationFrame = cancelAnimationFrame;
    } else {
        _requestAnimationFrame = function (cb) {
            return setTimeout(function () {
                cb(new Date().getTime());
            }, 20);
        }
        _cancelAnimationFrame = function (token) {
            return clearTimeout(token);
        }
    }

    /**
     * https://github.com/gre/bezier-easing
     * BezierEasing - use bezier curve for transition easing function
     * by Gaëtan Renaudeau 2014 - 2015 – MIT License
     */

    // These values are established by empiricism with tests (tradeoff: performance VS precision)
    var NEWTON_ITERATIONS = 4;
    var NEWTON_MIN_SLOPE = 0.001;
    var SUBDIVISION_PRECISION = 0.0000001;
    var SUBDIVISION_MAX_ITERATIONS = 10;

    var kSplineTableSize = 11;
    var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

    var float32ArraySupported = typeof Float32Array === 'function';

    function A(aA1, aA2) { return 1.0 - 3.0 * aA2 + 3.0 * aA1; }
    function B(aA1, aA2) { return 3.0 * aA2 - 6.0 * aA1; }
    function C(aA1) { return 3.0 * aA1; }

    // Returns x(t) given t, x1, and x2, or y(t) given t, y1, and y2.
    function calcBezier(aT, aA1, aA2) { return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT; }

    // Returns dx/dt given t, x1, and x2, or dy/dt given t, y1, and y2.
    function getSlope(aT, aA1, aA2) { return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1); }

    function binarySubdivide(aX, aA, aB, mX1, mX2) {
        var currentX, currentT, i = 0;
        do {
            currentT = aA + (aB - aA) / 2.0;
            currentX = calcBezier(currentT, mX1, mX2) - aX;
            if (currentX > 0.0) {
                aB = currentT;
            } else {
                aA = currentT;
            }
        } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
        return currentT;
    }

    function newtonRaphsonIterate(aX, aGuessT, mX1, mX2) {
        for (var i = 0; i < NEWTON_ITERATIONS; ++i) {
            var currentSlope = getSlope(aGuessT, mX1, mX2);
            if (currentSlope === 0.0) {
                return aGuessT;
            }
            var currentX = calcBezier(aGuessT, mX1, mX2) - aX;
            aGuessT -= currentX / currentSlope;
        }
        return aGuessT;
    }

    function bezier(mX1, mY1, mX2, mY2) {
        if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) {
            throw new Error('bezier x values must be in [0, 1] range');
        }

        // Precompute samples table
        var sampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);
        if (mX1 !== mY1 || mX2 !== mY2) {
            for (var i = 0; i < kSplineTableSize; ++i) {
                sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
            }
        }

        function getTForX(aX) {
            var intervalStart = 0.0;
            var currentSample = 1;
            var lastSample = kSplineTableSize - 1;

            for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
                intervalStart += kSampleStepSize;
            }
            --currentSample;

            // Interpolate to provide an initial guess for t
            var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
            var guessForT = intervalStart + dist * kSampleStepSize;

            var initialSlope = getSlope(guessForT, mX1, mX2);
            if (initialSlope >= NEWTON_MIN_SLOPE) {
                return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
            } else if (initialSlope === 0.0) {
                return guessForT;
            } else {
                return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
            }
        }

        return function BezierEasing(x) {
            if (mX1 === mY1 && mX2 === mY2) {
                return x; // linear
            }
            // Because JavaScript number are imprecise, we should guarantee the extremes are right.
            if (x === 0) {
                return 0;
            }
            if (x === 1) {
                return 1;
            }
            return calcBezier(getTForX(x), mY1, mY2);
        };
    }

    function noop() {

    }

    // function bt(p1, p2, t) {
    //     return 3 * p1 * t - 6 * p1 * t * t + 3 * p1 * t * t * t + 3 * p2 * t * t - 3 * p2 * t * t * t + t * t * t
    // }

    // function bdt(p1, p2, t) {
    //     return 3 * p1 - 12 * p1 * t + 9 * p1 * t * t + 6 * p2 * t - 9 * p2 * t * t + 3 * t * t;
    // }
    // function tb(p1, p2, b) {
    //     var b0 = 0;
    //     var b1 = 0;
    //     for (var t = 0; t <= 5000; t++) {
    //         b1 = bt(p1, p2, t / 5000);
    //         if ((b0 <= b && b1 >= b) || (b1 <= b && b0 >= b)) {
    //             return t;
    //         } else {
    //             b0 = b1;
    //         }
    //     }
    // }
    // function CubicBezier(x1, y1, x2, y2) {
    //     this._pxs = [x1, x2];
    //     this._pys = [y1, y2];
    // }


    // CubicBezier.prototype = {
    //     constructor: CubicBezier,
    //     getYForX: function (x) {
    //         return bt.apply(null, this._pys.concat(tb.apply(null, this._pxs.concat(x))));
    //     }
    // }
    // function easing(x1, y1, x2, y2) {
    //     var cubicBezier = new CubicBezier(x1, y1, x2, y2);
    //     return function (t) {
    //         cubicBezier.getYForX(t);
    //     }
    // }

    var INITED = 0;
    var STARTED = 1;
    var WAITING = 2;
    var RUNNING = 3;
    var FINISHED = 4;

    function Animation(config) {
        this._onEnd = config.onEnd || noop;
        this._onStart = config.onStart || noop;
        this._onProgress = config.onProgress || noop;
        this.progress = 0;
        this.duration = config.duration;
        this._status = INITED;// 0 :init ,1:started,2:waiting,3,complete
        this._timestamp = 0;
        this._easing = bezier.apply(null, config.easing);
        this.pastTime = 0;

    }

    Animation.prototype = {
        start: function () {
            this.progress = 0;
            this.pastTime = 0;
            this._status = STARTED;
            this._onStart();
            this._onProgress(this.progress);
            this.update();
        },
        update: function () {
            var self = this;
            this._status = RUNNING;
            this._timestamp = Date.now();
            _requestAnimationFrame(function () {
                if (self._status !== RUNNING) {
                    return;
                } else {
                    var pastTime = Math.min(Date.now() - self._timestamp + self.pastTime, self.duration);
                    self.pastTime = pastTime;
                    var progress = self._easing(pastTime / self.duration);
                    self.progress = progress;
                    self._onProgress(progress);
                    if (pastTime == self.duration) {
                        self.animationEnd();
                    } else {
                        self.update();
                    }
                };
            })
        },
        delay: function (ms) {
            var self = this;
            setTimeout(function () {
                self.start();
            }, ms)
        },
        wait: function (ms) {
            this._status = WAITING;
        },
        continueAnimation: function () {
            this.update();
        },
        finish: function () {
            this.progress = 1;
            this.update();
        },
        animationEnd: function () {
            this._status = FINISHED;
            this._onEnd();
        }
    }

    /**
     * 
     * @param {any} config 
     * @config duration
     * @config easing
     */

    function create(config) {
        return new Animation(config);
    }

    function timing(config) {
        config.easing = config.easing || [0.25, 0.1, 0.25, 1.0];
        config.duration = config.duration || 500;
        return create(config);
    }
    /**
     * 0.25, 0.1, 0.25, 1.0
     * 
     */
    function linear(config) {
        config.easing = [0.25, 0.1, 0.25, 1.0];
        return timing(config);
    }
    /**
     * 0.0, 0.0, 1.0, 1.0
     * 
     */
    function ease(config) {
        config.easing = [0.0, 0.0, 1.0, 1.0];
        return timing(config);
    }
    /**
     * 0.42, 0, 1.0, 1.0
     * 
     */
    function easeIn(config) {
        config.easing = [0.42, 0, 1.0, 1.0];
        return timing(config);
    }
    /**
    * 0, 0, 0.58, 1.0
    * 
    */
    function easeOut(config) {
        config.easing = [0, 0, 0.58, 1.0];
        return timing(config);
    }
    /**
     * 0.42, 0, 0.58, 1.0
     * 
     */
    function easeInOut(config) {
        config.easing = [0.42, 0, 0.58, 1.0];
        return timing(config);
    }
    return {
        create: create,
        timing: timing,
        linear: linear,
        ease: ease,
        easeIn: easeIn,
        easeOut: easeOut,
        easeInOut: easeInOut

    }
})