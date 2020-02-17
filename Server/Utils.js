class Stream {
  constructor(callback, interval) {
    this.callback = callback;
    this.interval = interval;
    this.time;
    this.stream;
  }

  start() {
    this.stop();
    this.stream = setInterval(() => {
      this.time += this.interval;
      this.callback(this.time);
    }, this.interval);
  }

  stop() {
    this.time = 0;
    clearInterval(this.stream);
  }
}

class Timer extends Stream {
  constructor(callback) {
    super(time => {
      let currTime = this.format(time / 1000);
      callback(currTime);
    }, 1000);
  }

  format(time) {
    let seconds = time % 60;
    let hours = Math.floor(time / 3600);
    let minutes = Math.floor(Math.floor(time / 60) % 60);
    let ss = (seconds < 10 ? "0" : "") + seconds;
    let mm = (minutes < 10 ? "0" : "") + minutes;
    return mm + ":" + ss;
  }
}

const UID = () => {
  return Math.floor(Math.random() * 1000000);
};

const https = require("https");

const wakeUpDyno = () => {
  setInterval(() => {
    https.get("https://thesmartglove.herokuapp.com/").on("error", err => {
      console.log("Ping Error: " + err.message);
    });
  }, 1500000);
};

module.exports = {
  Stream,
  Timer,
  wakeUpDyno,
  UID
};
