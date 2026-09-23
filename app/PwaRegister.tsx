"use client";
import { useEffect } from "react";
export default function PwaRegister(){useEffect(()=>{if(!("serviceWorker" in navigator))return;const id=window.setTimeout(()=>{navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>undefined)},0);return()=>window.clearTimeout(id)},[]);return null;}
