import { useEffect, useRef, useState } from "react";
import { Heart, Pause, Play as PlayIcon, Volume2, VolumeX } from "lucide-react";
import { drawItemIcon } from "@/game/atlas";
import { Engine, type Hud } from "@/game/engine";
import type { ItemId } from "@/game/content";
import { renderFrame } from "@/game/render";
import { unlockAudio } from "@/game/audio";

function Glyph({ id }: { id: ItemId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 32, 32);
    ctx.imageSmoothingEnabled = false;
    drawItemIcon(ctx, id, 2, 2, 28);
  }, [id]);
  return <canvas ref={ref} width={32} height={32} aria-hidden />;
}

export function FirstNight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engRef = useRef<Engine | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine();
    engRef.current = engine;
    engine.attachDebug();
    engine.bind(window);
    engine.onHud = () => setHud(engine.hud());
    const layout = () => {
      engine.touchLayout = window.innerWidth < 860;
    };
    layout();
    window.addEventListener("resize", layout);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAcc = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cssW = canvas.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || window.innerHeight;
      engine.view.cssW = cssW;
      engine.view.cssH = cssH;
      engine.view.scale = cssW < 900 ? 2 : 3;
      acc += dt;
      const step = 1 / 60;
      while (acc >= step) {
        engine.fixed(step);
        acc -= step;
      }
      engine.visual(dt);
      renderFrame(canvas, engine);
      hudAcc += dt;
      if (hudAcc > 0.12) {
        hudAcc = 0;
        setHud(engine.hud());
      }
      raf = requestAnimationFrame(frame);
    };
    setHud(engine.hud());
    raf = requestAnimationFrame(frame);
    const vis = () => {
      if (document.hidden) engine.save();
      else unlockAudio();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", layout);
      document.removeEventListener("visibilitychange", vis);
      engine.onHud = null;
      engine.destroy();
      engRef.current = null;
    };
  }, []);

  const eng = () => engRef.current;

  return (
    <div className="fn-root" onContextMenu={(e) => e.preventDefault()}>
      <canvas
        ref={canvasRef}
        className="fn-canvas"
        onPointerDown={(e) => {
          const g = eng();
          if (!g || g.mode !== "play" || g.paused) return;
          if (e.pointerType !== "touch" && e.button !== 0 && e.button !== 2) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          g.setPointer(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === "touch" ? "touch" : "mouse");
          if (e.button === 2) g.requestPlace();
          else g.pointerStroke(true);
        }}
        onPointerMove={(e) => {
          const g = eng();
          if (!g) return;
          if (e.pointerType === "touch" && e.buttons === 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          g.setPointer(e.clientX - rect.left, e.clientY - rect.top, e.pointerType === "touch" ? "touch" : "mouse");
        }}
        onPointerUp={(e) => eng()?.pointerStroke(false)}
        onPointerCancel={() => eng()?.pointerStroke(false)}
      />
      {!hud ? <Boot /> : hud.mode === "menu" ? <Menu hud={hud} eng={eng} /> : <Play hud={hud} eng={eng} />}
    </div>
  );
}

function Boot() {
  return (
    <section className="fn-menu">
      <p className="fn-kicker">随机的地，确定的夜</p>
      <h1 className="fn-title">第一夜</h1>
      <p className="fn-lead">白昼大约两分钟。天黑之前，给自己留一间能睡的屋子。</p>
    </section>
  );
}

function Menu({ hud, eng }: { hud: Hud; eng: () => Engine | null }) {
  return (
    <section className="fn-menu">
      <p className="fn-kicker">随机的地，确定的夜</p>
      <h1 className="fn-title">第一夜</h1>
      <p className="fn-lead">
        白昼大约两分钟。资源在哪，每次都不一样。天黑之前砍树、做门、点一盏灯，给自己留一间能睡的屋子。撑过去，第二天再慢慢布置。
      </p>
      <div className="fn-actions">
        <button className="fn-btn fn-btn-primary" onClick={() => eng()?.startNew()}>
          出发
        </button>
        {hud.hasSave ? (
          <button className="fn-btn" onClick={() => eng()?.continueGame()}>
            接着过
          </button>
        ) : null}
        <button className="fn-btn" onClick={() => eng()?.reroll()}>
          换一张地图
        </button>
      </div>
      <p className="fn-seed">地图 #{hud.seed}</p>
    </section>
  );
}

function Play({ hud, eng }: { hud: Hud; eng: () => Engine | null }) {
  const hold = (key: "left" | "right" | "jump" | "mine", on: boolean) => {
    eng()?.setPad({ [key]: on });
  };
  const now = hud.recipes.filter((r) => !r.dawn);
  const later = hud.recipes.filter((r) => r.dawn);
  const hand = now.filter((r) => r.station === "hand");
  const bench = now.filter((r) => r.station === "bench");
  return (
    <>
      <header className="fn-top">
        <div className="fn-row">
          <div className="fn-hearts" aria-label={`生命 ${hud.hp}`}>
            {Array.from({ length: hud.maxHp }, (_, i) => (
              <Heart key={i} className={i < hud.hp ? "fn-heart fn-heart-on" : "fn-heart"} />
            ))}
          </div>
          <div className="fn-clock">
            <div className="fn-clock-label">
              <span>{hud.clock}</span>
              <span>{hud.remain}</span>
            </div>
            <div className={hud.phase === "night" ? "fn-bar fn-bar-night" : hud.phase === "dusk" ? "fn-bar fn-bar-dusk" : "fn-bar"}>
              <i style={{ width: `${Math.round(hud.remainPct * 100)}%` }} />
            </div>
          </div>
          <button className="fn-icon-btn" onClick={() => eng()?.toggleMute()} aria-label={hud.muted ? "打开声音" : "关闭声音"}>
            {hud.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button className="fn-icon-btn" onClick={() => eng()?.togglePause()} aria-label="暂停">
            <Pause size={18} />
          </button>
        </div>
        <p className="fn-objective">{hud.objective}</p>
        <div className="fn-chips">
          <span className={hud.enclosed ? "fn-chip fn-chip-ok" : hud.night ? "fn-chip fn-chip-bad" : "fn-chip"}>
            {hud.tooBig ? "屋子太大" : hud.enclosed ? "屋子封住了" : "屋子还敞着"}
          </span>
          <span className={hud.lit ? "fn-chip fn-chip-ok" : hud.night ? "fn-chip fn-chip-bad" : "fn-chip"}>
            {hud.lit ? "灯够亮" : "还没灯"}
          </span>
          <span className={hud.bed ? "fn-chip fn-chip-ok" : "fn-chip"}>{hud.bed ? "床在身边" : "床还没放"}</span>
          {hud.survived || hud.endured ? <span className="fn-chip fn-chip-ok">温馨 {hud.cozy}/{hud.cozyMax}</span> : null}
        </div>
      </header>
      {hud.toast ? <div className="fn-toast">{hud.toast}</div> : null}
      <footer className="fn-bottom">
        <div className="fn-hotbar">
          {hud.hotbar.map((slot, i) => (
            <button
              key={i}
              className={i === hud.selected ? "fn-slot fn-slot-on" : "fn-slot"}
              onClick={() => eng()?.selectSlot(i)}
              aria-label={slot ? slot.id : `空格 ${i + 1}`}
            >
              {slot ? <Glyph id={slot.id} /> : null}
              {slot && slot.n > 1 ? <span className="fn-count">{slot.n}</span> : null}
            </button>
          ))}
        </div>
        <div className="fn-pads">
          <div className="fn-pad-cluster">
            <Pad label="左" onHold={(on) => hold("left", on)} />
            <Pad label="右" onHold={(on) => hold("right", on)} />
            <Pad label="跳" onHold={(on) => hold("jump", on)} />
          </div>
          <div className="fn-pad-cluster">
            <Pad label="挖" onHold={(on) => hold("mine", on)} />
            <button className="fn-pad" onClick={() => eng()?.requestPlace()}>
              放
            </button>
            <button className="fn-pad fn-pad-go" onClick={() => eng()?.requestUse()}>
              {hud.night && hud.bed ? "睡" : "用"}
            </button>
          </div>
        </div>
        <div className="fn-row">
          <button className="fn-btn" onClick={() => eng()?.toggleCraft()}>
            {hud.craftOpen ? "收起制作" : "制作"}
          </button>
          <p className="fn-keys">点方块挖 · 点空地放 · A D 移动 · 空格跳 · 右键也能放 · 1–8 选格子</p>
          <p className="fn-hint">点方块就挖，点空地就放。琥珀格子是即将放下的位置。</p>
        </div>
      </footer>
      {hud.craftOpen ? (
        <aside className="fn-craft">
          <h2>制作</h2>
          <p className="fn-lead">{hud.nearBench ? "工作台在身边。" : "徒手只能做木板和工作台。"}</p>
          <p className="fn-sub">徒手</p>
          {hand.map((r) => (
            <RecipeButton key={r.id} recipe={r} onCraft={() => eng()?.craft(r.id)} />
          ))}
          <p className="fn-sub">工作台</p>
          {bench.map((r) => (
            <RecipeButton key={r.id} recipe={r} onCraft={() => eng()?.craft(r.id)} />
          ))}
          {hud.survived || hud.endured ? (
            <>
              <p className="fn-sub">第二天</p>
              {later.map((r) => (
                <RecipeButton key={r.id} recipe={r} onCraft={() => eng()?.craft(r.id)} />
              ))}
            </>
          ) : (
            <p className="fn-lead">撑过今夜，才能做窗、桌、灯和花。</p>
          )}
          {hud.bag.length ? (
            <>
              <p className="fn-sub">背包 · 点一下放进选中的格子</p>
              <div className="fn-bag">
                {hud.bag.map((item) => (
                  <button key={item.id} className="fn-slot" onClick={() => eng()?.assign(item.id)}>
                    <Glyph id={item.id} />
                    <span className="fn-count">{item.n}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </aside>
      ) : null}
      {hud.paused ? (
        <section className="fn-pause">
          <h2>先停一下</h2>
          <p>进度记在这台设备上。夜里的时间也会停。</p>
          <div className="fn-actions">
            <button className="fn-btn fn-btn-primary" onClick={() => eng()?.togglePause()}>
              <PlayIcon size={16} /> 继续
            </button>
            <button className="fn-btn" onClick={() => eng()?.abandon()}>
              放弃，回标题
            </button>
          </div>
        </section>
      ) : null}
      {hud.banner ? (
        <section className="fn-banner">
          <h2>{hud.banner === "haven" ? "天亮了" : "你熬过来了"}</h2>
          <p>
            {hud.banner === "haven"
              ? "门外安静了。这间屋子现在只属于你，窗、桌子、灯和花都可以慢慢加。"
              : "这一夜没有屋子也活下来了。今天不会再黑，把缺的墙、灯和床补上吧。"}
          </p>
          <button className="fn-btn fn-btn-primary" onClick={() => eng()?.dismissBanner()}>
            去布置
          </button>
        </section>
      ) : null}
    </>
  );
}

function RecipeButton({
  recipe,
  onCraft,
}: {
  recipe: Hud["recipes"][number];
  onCraft: () => void;
}) {
  return (
    <button className={recipe.ok ? "fn-recipe fn-recipe-ok" : "fn-recipe"} disabled={!recipe.ok} onClick={onCraft}>
      <strong>{recipe.name}</strong>
      <small>
        {recipe.needs.map((n) => `${n.name} ${n.have}/${n.need}`).join(" · ")}
        {recipe.ok ? "" : ` · ${recipe.reason}`}
      </small>
    </button>
  );
}

function Pad({ label, onHold }: { label: string; onHold: (on: boolean) => void }) {
  return (
    <button
      className="fn-pad"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onLostPointerCapture={() => onHold(false)}
    >
      {label}
    </button>
  );
}
