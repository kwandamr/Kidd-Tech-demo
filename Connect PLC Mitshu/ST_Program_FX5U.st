(* ══════════════════════════════════════════════════════════════
   ST Program — FX5U / GX Simulator3
   Silo Monitor: 20 Silos × 3 Sensors + Fault Detection
   Copy ทั้งหมดนี้ไปวางใน Program Body ของ GX Works3
   ══════════════════════════════════════════════════════════════

   Register Map:
   D100–D119  = Temperature × 10   (275 = 27.5°C)
   D200–D219  = CO₂ ppm
   D300–D319  = Moisture × 10      (142 = 14.2%)
   D400–D419  = Fan Status          (0=OFF, 1=ON)
   D500–D519  = Sensor Fault Flag   (0=OK, 1=FAULT)

   Fault Rule: ถ้า Temp/CO2/Moist = 0 ให้ถือว่า sensor fault
   ══════════════════════════════════════════════════════════════ *)

(* ─── SILO S01 ─── *)
D100 := 275;    (* Temp 27.5°C  *)
D200 := 420;    (* CO2  420 ppm *)
D300 := 142;    (* Moist 14.2%  *)
D400 := 1;      (* Fan ON       *)
IF D100 = 0 OR D200 = 0 OR D300 = 0 THEN D500 := 1; ELSE D500 := 0; END_IF;

(* ─── SILO S02 ─── *)
D101 := 290;
D201 := 380;
D301 := 138;
D401 := 0;
IF D101 = 0 OR D201 = 0 OR D301 = 0 THEN D501 := 1; ELSE D501 := 0; END_IF;

(* ─── SILO S03 ─── alarm silo ─── *)
D102 := 340;    (* Temp 34.0°C  ← สูง! *)
D202 := 1650;   (* CO2  1650 ppm ← เกิน alert *)
D302 := 158;    (* Moist 15.8%  ← สูง *)
D402 := 1;
IF D102 = 0 OR D202 = 0 OR D302 = 0 THEN D502 := 1; ELSE D502 := 0; END_IF;

(* ─── SILO S04 ─── *)
D103 := 265;
D203 := 410;
D303 := 135;
D403 := 0;
IF D103 = 0 OR D203 = 0 OR D303 = 0 THEN D503 := 1; ELSE D503 := 0; END_IF;

(* ─── SILO S05 ─── *)
D104 := 272;
D204 := 395;
D304 := 140;
D404 := 1;
IF D104 = 0 OR D204 = 0 OR D304 = 0 THEN D504 := 1; ELSE D504 := 0; END_IF;

(* ─── SILO S06 ─── *)
D105 := 281;
D205 := 430;
D305 := 145;
D405 := 0;
IF D105 = 0 OR D205 = 0 OR D305 = 0 THEN D505 := 1; ELSE D505 := 0; END_IF;

(* ─── SILO S07 ─── *)
D106 := 268;
D206 := 405;
D306 := 137;
D406 := 1;
IF D106 = 0 OR D206 = 0 OR D306 = 0 THEN D506 := 1; ELSE D506 := 0; END_IF;

(* ─── SILO S08 ─── *)
D107 := 295;
D207 := 460;
D307 := 152;
D407 := 1;
IF D107 = 0 OR D207 = 0 OR D307 = 0 THEN D507 := 1; ELSE D507 := 0; END_IF;

(* ─── SILO S09 ─── *)
D108 := 278;
D208 := 415;
D308 := 143;
D408 := 0;
IF D108 = 0 OR D208 = 0 OR D308 = 0 THEN D508 := 1; ELSE D508 := 0; END_IF;

(* ─── SILO S10 ─── *)
D109 := 263;
D209 := 390;
D309 := 136;
D409 := 0;
IF D109 = 0 OR D209 = 0 OR D309 = 0 THEN D509 := 1; ELSE D509 := 0; END_IF;

(* ─── SILO S11 ─── *)
D110 := 285;
D210 := 445;
D310 := 147;
D410 := 1;
IF D110 = 0 OR D210 = 0 OR D310 = 0 THEN D510 := 1; ELSE D510 := 0; END_IF;

(* ─── SILO S12 ─── *)
D111 := 271;
D211 := 400;
D311 := 139;
D411 := 0;
IF D111 = 0 OR D211 = 0 OR D311 = 0 THEN D511 := 1; ELSE D511 := 0; END_IF;

(* ─── SILO R01 ─── *)
D112 := 288;
D212 := 425;
D312 := 146;
D412 := 1;
IF D112 = 0 OR D212 = 0 OR D312 = 0 THEN D512 := 1; ELSE D512 := 0; END_IF;

(* ─── SILO R02 ─── *)
D113 := 267;
D213 := 385;
D313 := 134;
D413 := 0;
IF D113 = 0 OR D213 = 0 OR D313 = 0 THEN D513 := 1; ELSE D513 := 0; END_IF;

(* ─── SILO R03 ─── *)
D114 := 293;
D214 := 455;
D314 := 151;
D414 := 1;
IF D114 = 0 OR D214 = 0 OR D314 = 0 THEN D514 := 1; ELSE D514 := 0; END_IF;

(* ─── SILO R04 ─── *)
D115 := 270;
D215 := 398;
D315 := 141;
D415 := 0;
IF D115 = 0 OR D215 = 0 OR D315 = 0 THEN D515 := 1; ELSE D515 := 0; END_IF;

(* ─── SILO R05 ─── *)
D116 := 276;
D216 := 408;
D316 := 144;
D416 := 1;
IF D116 = 0 OR D216 = 0 OR D316 = 0 THEN D516 := 1; ELSE D516 := 0; END_IF;

(* ─── SILO R06 ─── *)
D117 := 284;
D217 := 435;
D317 := 148;
D417 := 0;
IF D117 = 0 OR D217 = 0 OR D317 = 0 THEN D517 := 1; ELSE D517 := 0; END_IF;

(* ─── SILO R07 ─── *)
D118 := 269;
D218 := 392;
D318 := 135;
D418 := 1;
IF D118 = 0 OR D218 = 0 OR D318 = 0 THEN D518 := 1; ELSE D518 := 0; END_IF;

(* ─── SILO R08 ─── *)
D119 := 282;
D219 := 440;
D319 := 149;
D419 := 0;
IF D119 = 0 OR D219 = 0 OR D319 = 0 THEN D519 := 1; ELSE D519 := 0; END_IF;

