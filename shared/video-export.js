/* Shared loop-video exporter. Frame-exact: every frame k is rendered at time k/FPS (independent of screen refresh),
   encoded as H.264 with WebCodecs and muxed to MP4. Falls back to real-time MediaRecorder where WebCodecs is missing.
   Needs shared/vendor/mp4-muxer-*.js loaded first (global Mp4Muxer).

   VideoExport.run({ canvas, renderAt(t), period, fps, width, height, status(text) }) -> { blob, ext, note }
   VideoExport.save(filename, blob) -> "saved" | error code                                                    */
(function () {
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function pickMime() {
    var c = [["video/mp4;codecs=avc1", "mp4"], ["video/mp4", "mp4"], ["video/webm;codecs=vp9", "webm"], ["video/webm", "webm"]];
    for (var i = 0; i < c.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported(c[i][0])) return c[i];
    return ["", "webm"];
  }

  async function webCodecs(o) {
    if (!(window.VideoEncoder && window.VideoFrame && window.Mp4Muxer)) return null;
    var W = o.width, H = o.height, FPS = o.fps;
    var base = { width: W, height: H, bitrate: Math.round(W * H * FPS * 0.25), framerate: FPS, latencyMode: "quality" };
    var cfg = null, codecs = ["avc1.64002A", "avc1.640034", "avc1.4D402A", "avc1.42E02A"];
    for (var i = 0; i < codecs.length && !cfg; i++) {
      try {
        var r = await VideoEncoder.isConfigSupported(Object.assign({}, base, { codec: codecs[i] }));
        if (r && r.supported) cfg = Object.assign({}, base, { codec: codecs[i] });
      } catch (e) {}
    }
    if (!cfg) return null;
    var muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" });
    var encErr = null;
    var enc = new VideoEncoder({ output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); }, error: function (e) { encErr = e; } });
    enc.configure(cfg);
    var N = Math.round(o.period * FPS), us = 1e6 / FPS;
    for (var k = 0; k < N; k++) {
      if (encErr) throw encErr;
      o.renderAt(k / FPS);                    // frame k+N would equal frame 0: seamless loop
      var f = new VideoFrame(o.canvas, { timestamp: Math.round(k * us), duration: Math.round(us) });
      enc.encode(f, { keyFrame: k % (FPS * 2) === 0 }); f.close();
      while (enc.encodeQueueSize > 8) await sleep(4);
      if (k % 5 === 0) { o.status("Rendering… " + (k + 1) + " / " + N + " frames"); await sleep(0); }
    }
    await enc.flush(); enc.close(); muxer.finalize();
    return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), ext: "mp4",
      note: "H.264 · " + (cfg.bitrate / 1e6).toFixed(0) + " Mbps · " + FPS + " fps · " + N + " frames" };
  }

  async function recorder(o) {
    var mt = pickMime(), mime = mt[0], ext = mt[1];
    var rec = new MediaRecorder(o.canvas.captureStream(o.fps), { mimeType: mime || undefined, videoBitsPerSecond: Math.round(o.width * o.height * o.fps * 0.3) });
    var chunks = []; rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    var stopped = new Promise(function (res) { rec.onstop = res; });
    rec.start(250);
    var t0 = performance.now();
    await new Promise(function (resolve) {
      (function step(now) {
        var t = Math.max(0, (performance.now() - t0) / 1000);   // rAF timestamps can precede t0
        if (t >= o.period) { resolve(); return; }
        o.renderAt(t); o.status("Recording in real time… " + t.toFixed(1) + " / " + o.period + " s");
        requestAnimationFrame(step);
      })(performance.now());
    });
    o.renderAt(0); await sleep(150);
    rec.stop(); await stopped;
    return { blob: new Blob(chunks, { type: rec.mimeType || "video/webm" }), ext: ext,
      note: "real-time recording · " + o.period + " s" + (ext === "webm" ? " · WebM: convert to MP4 for Instagram" : "") };
  }

  async function run(o) {
    var out = null;
    try { out = await webCodecs(o); } catch (err) { console.warn("WebCodecs failed, using real-time recording:", err); }
    if (!out) {
      if (!window.MediaRecorder) throw new Error("This browser cannot export video.");
      out = await recorder(o);
    }
    return out;
  }

  // Inside a Claude artifact downloads go through the "downloads" capability; on a normal site, a plain download link.
  async function save(name, blob) {
    if (typeof claude === "undefined" || !claude.use) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return "saved";
    }
    try { var dl = await claude.use("downloads"); if (!dl) return "unavailable"; await dl.save({ filename: name, data: blob }); return "saved"; }
    catch (err) { return (err && err.code) || "error"; }
  }

  window.VideoExport = { run: run, save: save };
})();
