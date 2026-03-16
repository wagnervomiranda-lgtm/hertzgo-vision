14:32:59.352 Running build in Washington, D.C., USA (East) – iad1
14:32:59.352 Build machine configuration: 2 cores, 8 GB
14:32:59.508 Cloning github.com/wagnervomiranda-lgtm/hertzgo-vision (Branch: main, Commit: c4d3dce)
14:32:59.792 Cloning completed: 283.000ms
14:33:00.521 Restored build cache from previous deployment (J86Ga4HdJn2EooQqGmczdp6c4ayo)
14:33:00.806 Running "vercel build"
14:33:01.398 Vercel CLI 50.32.4
14:33:01.690 Installing dependencies...
14:33:04.569 
14:33:04.570 up to date in 3s
14:33:04.571 
14:33:04.571 3 packages are looking for funding
14:33:04.571   run `npm fund` for details
14:33:04.606 Detected Next.js version: 14.2.35
14:33:04.609 Running "npm run build"
14:33:04.731 
14:33:04.732 > hertzgo-vision@0.1.0 build
14:33:04.732 > next build
14:33:04.732 
14:33:05.404   ▲ Next.js 14.2.35
14:33:05.405 
14:33:05.422    Creating an optimized production build ...
14:33:13.470  ✓ Compiled successfully
14:33:13.471    Linting and checking validity of types ...
14:33:18.627 Failed to compile.
14:33:18.627 
14:33:18.627 ./src/app/page.tsx:1522:287
14:33:18.627 Type error: Conversion of type 'CupomRegistro' to type 'Record<string, string>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
14:33:18.627   Index signature for type 'string' is missing in type 'CupomRegistro'.
14:33:18.627 
14:33:18.628 [0m [90m 1520 |[39m             [33m<[39m[33mdiv[39m style[33m=[39m{{fontFamily[33m:[39m[33mT[39m[33m.[39msans[33m,[39mfontSize[33m:[39m[35m13[39m[33m,[39mfontWeight[33m:[39m[35m600[39m[33m,[39mcolor[33m:[39m[33mT[39m[33m.[39mtext[33m,[39mmarginBottom[33m:[39m[35m14[39m}}[33m>[39m➕ [33mAdicionar[39m [33mCupom[39m [33mManual[39m[33m<[39m[33m/[39m[33mdiv[39m[33m>[39m[0m
14:33:18.628 [0m [90m 1521 |[39m             [33m<[39m[33mdiv[39m style[33m=[39m{{display[33m:[39m[32m"grid"[39m[33m,[39mgridTemplateColumns[33m:[39m[32m"repeat(4,1fr)"[39m[33m,[39mgap[33m:[39m[35m10[39m[33m,[39mmarginBottom[33m:[39m[35m12[39m}}[33m>[39m[0m
14:33:18.628 [0m[31m[1m>[22m[39m[90m 1522 |[39m               {[{id[33m:[39m[32m"usuario"[39m[33m,[39mlabel[33m:[39m[32m"Usuário"[39m}[33m,[39m{id[33m:[39m[32m"motivo"[39m[33m,[39mlabel[33m:[39m[32m"Motivo"[39m}[33m,[39m{id[33m:[39m[32m"validade"[39m[33m,[39mlabel[33m:[39m[32m"Validade (ex: 2026-06-30)"[39m}[33m,[39m{id[33m:[39m[32m"estacao"[39m[33m,[39mlabel[33m:[39m[32m"Estação"[39m}][33m.[39mmap(f[33m=>[39m([33m<[39m[33mdiv[39m key[33m=[39m{f[33m.[39mid}[33m>[39m[33m<[39m[33mdiv[39m style[33m=[39m{{fontFamily[33m:[39m[33mT[39m[33m.[39mmono[33m,[39mfontSize[33m:[39m[35m10[39m[33m,[39mcolor[33m:[39m[33mT[39m[33m.[39mtext2[33m,[39mmarginBottom[33m:[39m[35m4[39m}}[33m>[39m{f[33m.[39mlabel}[33m<[39m[35m/div><input value={(novoCupom as Record<string,string>)[f.id]} onChange={e=>setNovoCupom(p=>({...p,[f.id]:e.target.value}))} style={{width:"100%",background:T.bg3,border:`1px solid ${T.border}`,color:T.text,padding:"6px 8px",borderRadius:8,fontSize:12,fontFamily:T.mono}}/[39m[33m>[39m[33m<[39m[33m/[39m[33mdiv[39m[33m>[39m))}[0m
14:33:18.629 [0m [90m      |[39m                                                                                                                                                                                                                                                                                               [31m[1m^[22m[39m[0m
14:33:18.629 [0m [90m 1523 |[39m             [33m<[39m[33m/[39m[33mdiv[39m[33m>[39m[0m
14:33:18.630 [0m [90m 1524 |[39m             [33m<[39m[33mbutton[39m onClick[33m=[39m{()[33m=>[39m{[36mif[39m([33m![39mnovoCupom[33m.[39musuario)[36mreturn[39m[33m;[39m[36mconst[39m updated[33m=[39m[[33m...[39mcupons[33m,[39mnovoCupom][33m;[39msetCupons(updated)[33m;[39monSave({cupons[33m:[39mupdated})[33m;[39msetNovoCupom({usuario[33m:[39m[32m""[39m[33m,[39mmotivo[33m:[39m[32m""[39m[33m,[39mvalidade[33m:[39m[32m""[39m[33m,[39mestacao[33m:[39m[32m""[39m})[33m;[39msetCupomSaved([36mtrue[39m)[33m;[39msetTimeout(()[33m=>[39msetCupomSaved([36mfalse[39m)[33m,[39m[35m1500[39m)[33m;[39m}} style[33m=[39m{{background[33m:[39mcupomSaved[33m?[39m[32m"rgba(0,229,160,0.2)"[39m[33m:[39m[33mT[39m[33m.[39mgreenDim[33m,[39mborder[33m:[39m[32m`1px solid ${cupomSaved?T.green:"rgba(0,229,160,0.3)"}`[39m[33m,[39mcolor[33m:[39m[33mT[39m[33m.[39mgreen[33m,[39mpadding[33m:[39m[32m"7px 18px"[39m[33m,[39mborderRadius[33m:[39m[35m8[39m[33m,[39mfontSize[33m:[39m[35m11[39m[33m,[39mcursor[33m:[39m[32m"pointer"[39m[33m,[39mfontFamily[33m:[39m[33mT[39m[33m.[39mmono}}[33m>[39m{cupomSaved[33m?[39m[32m"✅ Adicionado!"[39m[33m:[39m[32m"➕ Adicionar"[39m}[33m<[39m[33m/[39m[33mbutton[39m[33m>[39m[0m
14:33:18.630 [0m [90m 1525 |[39m           [33m<[39m[33m/[39m[33mPanel[39m[33m>[39m[0m
14:33:18.653 Next.js build worker exited with code: 1 and signal: null
14:33:18.672 Error: Command "npm run build" exited with 1