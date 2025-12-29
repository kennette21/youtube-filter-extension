var content=(function(){"use strict";function ee(t){return t}const p=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome,x="ytf_debug_logs",q=50;async function F(t,n){const o=await N();o.unshift({timestamp:Date.now(),source:t,message:n});const s=o.slice(0,q);await p.storage.local.set({[x]:s})}async function N(){return(await p.storage.local.get(x))[x]??[]}const P={productive:{name:"productive",label:"Productive",description:"Block entertainment, keep educational content",blockedCategories:["entertainment","reaction","gaming","shorts","other"]},learning:{name:"learning",label:"Learning Only",description:"Only allow tutorials and lectures",blockedCategories:["documentary","news","entertainment","reaction","gaming","shorts","other"]},relax:{name:"relax",label:"Relax Mode",description:"Allow everything (filtering off)",blockedCategories:[]},custom:{name:"custom",label:"Custom",description:"Choose which categories to block",blockedCategories:[]}},h={API_KEY:"apiKey",ENABLED:"enabled",PROFILE:"profile",CUSTOM_BLOCKED:"customBlockedCategories"},b={apiKey:"",enabled:!0,profile:"productive",customBlockedCategories:["entertainment","reaction","gaming","shorts","other"]};async function R(){const t=await p.storage.local.get([h.API_KEY,h.ENABLED,h.PROFILE,h.CUSTOM_BLOCKED]);return{apiKey:t[h.API_KEY]??b.apiKey,enabled:t[h.ENABLED]??b.enabled,profile:t[h.PROFILE]??b.profile,customBlockedCategories:t[h.CUSTOM_BLOCKED]??b.customBlockedCategories}}async function O(){const t=await R();return t.profile==="custom"?t.customBlockedCategories:P[t.profile].blockedCategories}function u(t){console.log("[YTF]",t),F("content",t)}const D={matches:["https://www.youtube.com/*"],main(){u("Content script loaded on: "+window.location.href);const t=new Set,n=new Set,o=new Map,s=new Map;let d=[],m=null,T=[];O().then(e=>{T=e,u("Loaded blocked categories: "+e.join(", ")),y()}),p.storage.onChanged.addListener(e=>{(e.profile||e.customBlockedCategories)&&O().then(i=>{T=i,u("Updated blocked categories: "+i.join(", ")),K()})}),X();let L=!1;new MutationObserver(()=>{L||(L=!0,setTimeout(()=>{y(),L=!1},200))}).observe(document.body,{childList:!0,subtree:!0}),setTimeout(y,500),setInterval(y,2e3);let U=location.href;new MutationObserver(()=>{location.href!==U&&(U=location.href,t.clear(),o.clear(),s.clear(),setTimeout(y,500))}).observe(document,{subtree:!0,childList:!0});function K(){document.querySelectorAll(".ytf-overlay, .ytf-hide-btn").forEach(e=>e.remove());for(const[e,i]of o){const r=s.get(e);r&&!n.has(e)&&A(i.category)&&C(r,i)}}function A(e){return T.includes(e)}function y(){const e=document.querySelectorAll("ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer"),i=[];e.forEach(r=>{const a=H(r);if(a&&a.title!=="Unknown Title"&&!t.has(a.videoId))if(t.add(a.videoId),s.set(a.videoId,a.element),j(a,r)){const c={video_id:a.videoId,category:"shorts",allow:!1,reason:"Shorts are blocked to reduce distractions"};o.set(a.videoId,c),A("shorts")&&C(a.element,c)}else $(a.element,a.videoId),i.push(a)}),i.length>0&&(u("Queuing "+i.length+" new videos for classification"),d.push(...i),G())}function $(e,i){if(n.has(i)||e.querySelector(".ytf-overlay, .ytf-loading-overlay"))return;e.style.position="relative";const r=document.createElement("div");r.className="ytf-loading-overlay",r.setAttribute("data-video-id",i),r.innerHTML=`
        <div class="ytf-loading-content">
          <div class="ytf-loading-spinner"></div>
          <div class="ytf-loading-text">Classifying...</div>
        </div>
      `,e.appendChild(r)}function z(e){const i=document.querySelector(`.ytf-loading-overlay[data-video-id="${e}"]`);i&&i.remove()}function G(){m&&clearTimeout(m),m=setTimeout(async()=>{if(d.length===0)return;const e=[...d];d=[];const i=e.map(r=>({videoId:r.videoId,title:r.title,channel:r.channel}));u("Sending "+i.length+" videos to API");try{const r=await p.runtime.sendMessage({type:"CLASSIFY",videos:i});if(r?.classifications){const a=r.classifications.filter(c=>!c.allow).length;u("Got "+r.classifications.length+" results, "+a+" blocked"),W(e,r.classifications)}else u("No classifications in response")}catch(r){u("ERROR: "+r.message),console.error("[YTF] Classification error:",r)}},300)}function H(e){const i=e.querySelector("a#video-title-link")||e.querySelector("a#video-title")||e.querySelector('a[href*="/watch?v="]')||e.querySelector("ytd-thumbnail a"),r=i?.getAttribute("href");if(!r)return null;const a=r.match(/\/watch\?v=([^&]+)/)||r.match(/\/shorts\/([^?]+)/);if(!a)return null;const c=a[1];let l="Unknown Title";const f=["#video-title","#video-title-link","a#video-title","yt-formatted-string#video-title",'[id="video-title"]',"h3 a","h3 yt-formatted-string","span#video-title",".title"];for(const v of f){const _=e.querySelector(v),g=_?.textContent?.trim()||_?.getAttribute("title");if(g&&g.length>0&&g!=="Unknown Title"){l=g;break}}if(l==="Unknown Title"&&i){const v=i.getAttribute("title");v&&(l=v)}let M="Unknown Channel";const J=["ytd-channel-name #text","ytd-channel-name yt-formatted-string","#channel-name #text","#channel-name yt-formatted-string","#channel-name",".ytd-channel-name",'a.yt-formatted-string[href*="/@"]','a[href*="/@"]',"#text.ytd-channel-name"];for(const v of J){const g=e.querySelector(v)?.textContent?.trim();if(g&&g.length>0&&g!=="Unknown Channel"){M=g;break}}(l==="Unknown Title"||M==="Unknown Channel")&&(console.log("[YTF] Extraction incomplete for",c),console.log("[YTF] Card HTML snippet:",e.innerHTML.substring(0,500)));const Z=e.querySelector("ytd-thumbnail")||e.querySelector("#thumbnail")||e.querySelector("#dismissible")||e;return{videoId:c,title:l,channel:M,element:Z}}function j(e,i){const r=i.querySelectorAll("a");for(const c of r)if(c.href.includes("/shorts/"))return!0;if(i.querySelector('[overlay-style="SHORTS"]'))return!0;const a=i.querySelectorAll("ytd-thumbnail-overlay-time-status-renderer");for(const c of a)if(c.getAttribute("overlay-style")==="SHORTS")return!0;return!1}function W(e,i){const r=new Map(i.map(l=>[l.video_id,l]));let a=0,c=0;for(const l of e){const f=r.get(l.videoId);z(l.videoId),f&&(o.set(l.videoId,f),s.set(l.videoId,l.element),A(f.category)?(C(l.element,f),a++):c++)}u("Classified: "+a+" blocked, "+c+" allowed")}function C(e,i){if(n.has(i.video_id)||e.querySelector(".ytf-overlay"))return;e.style.position="relative";const r=document.createElement("div");r.className="ytf-overlay",r.innerHTML=`
        <div class="ytf-overlay-content">
          <div class="ytf-category">${Q(i.category)}</div>
          <div class="ytf-reason">${i.reason||"Unproductive content"}</div>
          <button class="ytf-show-btn">Show Anyway</button>
        </div>
      `,r.querySelector(".ytf-show-btn")?.addEventListener("click",c=>{c.preventDefault(),c.stopPropagation(),n.add(i.video_id),r.remove();const l=document.createElement("button");l.className="ytf-hide-btn",l.textContent="Hide",l.addEventListener("click",f=>{f.preventDefault(),f.stopPropagation(),n.delete(i.video_id),l.remove(),C(e,i)}),e.appendChild(l)}),e.appendChild(r)}function Q(e){return e.charAt(0).toUpperCase()+e.slice(1)}function X(){const e=document.createElement("style");e.textContent=`
        .ytf-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          border-radius: 12px;
        }

        .ytf-overlay-content {
          text-align: center;
          color: white;
          padding: 16px;
          max-width: 90%;
        }

        .ytf-category {
          font-size: 14px;
          font-weight: 600;
          color: #f87171;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ytf-reason {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 12px;
          line-height: 1.4;
        }

        .ytf-show-btn {
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ytf-show-btn:hover {
          background: rgba(255, 255, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .ytf-hide-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          cursor: pointer;
          z-index: 100;
        }

        .ytf-hide-btn:hover {
          background: rgba(0, 0, 0, 0.9);
        }

        /* Loading overlay */
        .ytf-loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          border-radius: 12px;
        }

        .ytf-loading-content {
          text-align: center;
          color: white;
        }

        .ytf-loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: ytf-spin 0.8s linear infinite;
          margin: 0 auto 8px;
        }

        @keyframes ytf-spin {
          to { transform: rotate(360deg); }
        }

        .ytf-loading-text {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
        }
      `,document.head.appendChild(e)}}};function w(t,...n){}const B={debug:(...t)=>w(console.debug,...t),log:(...t)=>w(console.log,...t),warn:(...t)=>w(console.warn,...t),error:(...t)=>w(console.error,...t)};class k extends Event{constructor(n,o){super(k.EVENT_NAME,{}),this.newUrl=n,this.oldUrl=o}static EVENT_NAME=I("wxt:locationchange")}function I(t){return`${p?.runtime?.id}:content:${t}`}function V(t){let n,o;return{run(){n==null&&(o=new URL(location.href),n=t.setInterval(()=>{let s=new URL(location.href);s.href!==o.href&&(window.dispatchEvent(new k(s,o)),o=s)},1e3))}}}class S{constructor(n,o){this.contentScriptName=n,this.options=o,this.abortController=new AbortController,this.isTopFrame?(this.listenForNewerScripts({ignoreFirstEvent:!0}),this.stopOldScripts()):this.listenForNewerScripts()}static SCRIPT_STARTED_MESSAGE_TYPE=I("wxt:content-script-started");isTopFrame=window.self===window.top;abortController;locationWatcher=V(this);receivedMessageIds=new Set;get signal(){return this.abortController.signal}abort(n){return this.abortController.abort(n)}get isInvalid(){return p.runtime.id==null&&this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(n){return this.signal.addEventListener("abort",n),()=>this.signal.removeEventListener("abort",n)}block(){return new Promise(()=>{})}setInterval(n,o){const s=setInterval(()=>{this.isValid&&n()},o);return this.onInvalidated(()=>clearInterval(s)),s}setTimeout(n,o){const s=setTimeout(()=>{this.isValid&&n()},o);return this.onInvalidated(()=>clearTimeout(s)),s}requestAnimationFrame(n){const o=requestAnimationFrame((...s)=>{this.isValid&&n(...s)});return this.onInvalidated(()=>cancelAnimationFrame(o)),o}requestIdleCallback(n,o){const s=requestIdleCallback((...d)=>{this.signal.aborted||n(...d)},o);return this.onInvalidated(()=>cancelIdleCallback(s)),s}addEventListener(n,o,s,d){o==="wxt:locationchange"&&this.isValid&&this.locationWatcher.run(),n.addEventListener?.(o.startsWith("wxt:")?I(o):o,s,{...d,signal:this.signal})}notifyInvalidated(){this.abort("Content script context invalidated"),B.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){window.postMessage({type:S.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:Math.random().toString(36).slice(2)},"*")}verifyScriptStartedEvent(n){const o=n.data?.type===S.SCRIPT_STARTED_MESSAGE_TYPE,s=n.data?.contentScriptName===this.contentScriptName,d=!this.receivedMessageIds.has(n.data?.messageId);return o&&s&&d}listenForNewerScripts(n){let o=!0;const s=d=>{if(this.verifyScriptStartedEvent(d)){this.receivedMessageIds.add(d.data.messageId);const m=o;if(o=!1,m&&n?.ignoreFirstEvent)return;this.notifyInvalidated()}};addEventListener("message",s),this.onInvalidated(()=>removeEventListener("message",s))}}function ne(){}function E(t,...n){}const Y={debug:(...t)=>E(console.debug,...t),log:(...t)=>E(console.log,...t),warn:(...t)=>E(console.warn,...t),error:(...t)=>E(console.error,...t)};return(async()=>{try{const{main:t,...n}=D,o=new S("content",n);return await t(o)}catch(t){throw Y.error('The content script "content" crashed on startup!',t),t}})()})();
content;