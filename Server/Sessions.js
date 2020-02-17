var { Stream, Timer, UID } = require("./Utils");
var db = require("./InternalQueries");

class Session {
  constructor(socket, roomID) {
    this.roomID = roomID;
    this.socket = socket;
    this.sessionID = UID();
    this.streamInterval = 25;
    this.numSensors = 8;
    this.sensorData;
    this.x = 0;

    this.recordings = [];
    this.newRecording = [];
    this.currentRecording = [];
    this.recordingPos = 0;

    db.getRoomRecordings(this.roomID, recordings => {
      this.recordings = recordings;
      this.updateState(this.socket, "recordings", recordings);
    });

    this.timer = new Timer(time =>
      this.updateState(this.socket, "elapsedTime", time)
    );

    this.stream = new Stream(() => {
      this.updateState(this.socket, "sensorData", this.getData());
    }, this.streamInterval);

    this.currentState = {
      simulate: true,
      streaming: false,
      gloveConnect: false,
      recording: false,
      batteryLevel: "-",
      elapsedTime: "-",
      recordings: this.recordings,
      currentPlay: false
    };

    this.stateHandler = {
      streaming: this.handleStreaming,
      recording: this.handleRecording,
      currentPlay: this.handleRecordPlay,
      recordingsUpdate: this.handleRecordingUpdate
    };

    this.socket.on("connection", client => {
      client.on("clientConnect", () => {
        client.join("web");
        setTimeout(() => {
          client.emit("stateSync", this.currentState);
        }, 400);

        client.on("stateChange", (state, newState) => {
          this.updateState(client, state, newState, true);
        });

        client.on("patientConnect", clientID => {
          let now = new Date();
          this.sessionStart = now.getTime();
          db.createSession(this.sessionID, clientID);
        });

        client.on("disconnect", () => {
          let now = new Date();
          let duration = now.getTime() - this.sessionStart;
          let sessionDuration = Math.ceil(duration / 60000);
          db.updateSession(this.sessionID, sessionDuration);
        });
      });

      client.on("gloveConnect", () => {
        this.timer.start();
        this.updateState(this.socket, "gloveConnect", true);
        this.glove = client.id;

        client.on("batteryLevel", batteryLevel => {
          this.updateState(this.socket, "batteryLevel", batteryLevel);
        });

        client.on("sensorData", sensorData => {
          this.sensorData = sensorData;
        });

        client.on("disconnect", () => {
          this.timer.stop();
          this.updateState(this.socket, "elapsedTime", "-");
          this.updateState(this.socket, "gloveConnect", false);
          this.updateState(this.socket, "batteryLevel", "-");
        });
      });
    });
  }

  updateState(socket, stateName, stateValue, broadcast = false) {
    this.currentState[stateName] = stateValue;
    this.handleStateChange(stateName, stateValue);
    broadcast
      ? socket.to("web").broadcast.emit("stateChange", stateName, stateValue)
      : socket.to("web").emit("stateChange", stateName, stateValue);
  }

  handleStateChange(state, value) {
    if (this.stateHandler[state] !== undefined) {
      this.stateHandler[state].call(this, value);
    }
  }

  handleStreaming(stateValue) {
    stateValue ? this.stream.start() : this.stream.stop();
    if (this.currentState["gloveConnect"]) {
      this.socket.to(this.glove).emit("streamState", stateValue);
    }
  }

  handleRecordingUpdate(stateValue) {
    if (stateValue.func == "rename") {
      db.updateRecording(stateValue.id, stateValue.name);
    } else {
      db.deleteRecording(stateValue.id);
      if ((this.currentState["currentPlay"] = stateValue.id)) {
        this.updateState(this.socket, "currentPlay", false);
      }
    }

    setTimeout(() => {
      db.getRoomRecordings(this.roomID, recordings => {
        this.updateState(this.socket, "recordings", recordings);
      });
    }, 400);
  }

  handleRecording(stateValue) {
    if (stateValue) {
      this.newRecording = [];
      this.updateState(this.socket, "streaming", true);
      this.updateState(this.socket, "currentPlay", false);
    } else {
      if (this.newRecording.length > 20) {
        let name = "Recording " + (Object.keys(this.recordings).length + 1);
        //prettier-ignore
        db.createRecording(name, { data: this.newRecording }, this.sessionID, (recordingID) => {
          this.newRecordingID = recordingID;
          
          let recording = {
            Name: name,
            recordingID: this.newRecordingID
          };

          this.recordings.push(recording);
          this.updateState(this.socket, "recordings", this.recordings);
          this.updateState(this.socket, "currentPlay", false);
        
        });
      }
    }
  }

  handleRecordPlay(stateValue) {
    if (stateValue) {
      db.getRecording(stateValue, data => {
        this.currentRecording = data;
        // console.log(stateValue, data);
        this.recordingPos = 0;
        this.updateState(this.socket, "streaming", true);
      });
    }
  }

  simulateData() {
    let sensorData = [];
    this.x += 0.06;
    for (var i = 0; i < this.numSensors; i++) {
      sensorData.push(Math.abs(100 * Math.sin(i * 0.2 + this.x)).toFixed(3));
    }
    return sensorData;
  }

  recordingData() {
    let data = this.currentRecording[this.recordingPos];
    this.recordingPos += 1;
    if (this.recordingPos > this.currentRecording.length - 1) {
      this.recordingPos = 0;
    }

    return data;
  }

  getData() {
    let data;
    if (this.currentState["currentPlay"]) {
      data = this.recordingData();
    } else if (this.currentState["simulate"]) {
      data = this.simulateData();
    } else if (this.currentState["gloveConnect"]) {
      data = this.sensorData;
    } else {
      data = new Array(this.numSensors).fill(1);
    }

    if (this.currentState["recording"]) {
      this.newRecording.push(data);
    }

    return data;
  }
}

module.exports = Session;
