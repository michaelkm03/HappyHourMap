// script.js

// --- 1. CORE MAP AND DATA INITIALIZATION ---
let map;
let allMarkers = [];
let markersLayer = L.layerGroup();
const LIST_CONTAINER = document.getElementById('restaurant-list');
const API_BASE_URL = 'http://localhost:3000/api/resolve-google-link';

// Placeholder coordinates for demonstration (Los Angeles area)
const LA_CENTER = [34.0522, -118.2437]; 
const STARTING_ZOOM = 12;

// Hardcoded CSV content from the uploaded file (cleaned for PapaParse)
const RAW_CSV_DATA = `Name,URL,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday,GAMES?!,HAUNTED?!
MELROSE FAIRFAX / WEHO,,,,,,,,,,
Akuma,https://maps.app.goo.gl/JBrzJtMsUfsgY9jo6,"3pm-5pm 50% house sake / draft beer / wine","3pm-5pm 50% house sake / draft beer / wine","3pm-5pm 50% house sake / draft beer / wine","3pm-5pm 50% house sake / draft beer / wine","3pm-5pm 50% house sake / draft beer / wine",,,,
Badmaash,,3-6pm; 9 - 10pm $10 wine / $6 beer / $6-10 food specials,"3-6pm; 9 - 10pm $10 wine / $6 beer / $6-10 food specials","3-6pm; 9 - 10pm $10 wine / $6 beer / $6-10 food specials","3-6pm; 9 - 10pm $10 wine / $6 beer / $6-10 food specials","3-6pm $10 wine / $6 beer / $6-10 food specials","3-6pm $10 wine / $6 beer / $6-10 food specials","3-6pm; 9 - 10pm $10 wine / $6 beer / $6-10 food specials",,
Bao Dim Sum,,"5-7pm; $7 Beers Wines Wells / $9 apps / $10 cocktails","5-7pm; $7 Beers Wines Wells / $9 apps / $10 cocktails","5-7pm; $7 Beers Wines Wells / $9 apps / $10 cocktails","5-7pm; $7 Beers Wines Wells / $9 apps / $10 cocktails","5-7pm; $7 Beers Wines Wells / $9 apps / $10 cocktails",N/A,N/A,,
Bar Lubitsch,,TBC,TBC,TBC,TBC,TBC,,,DANCING,N
Barney's Beanery,,4-7pm,"4-7pm / Trivia @ 9pm!",4-7pm,4-7pm,4-7pm,,,POOL TABLES,Y
The Belmont,,N/A,"4-7pm $5-$6 beers / $7 spirits / $6 wine Karaoke @ 9pm","4-7pm $5-$6 beers / $7 spirits / Wine Weds $7 all day","4-7pm $5-$6 beers / $7 spirits / $6 wine","4-7pm $5-$6 beers / $7 spirits / $6 wine",,,TV'S,N
Blue Collar,,N/A,N/A,N/A,N/A,N/A,,,DARKNESS,M
Blue Daisy - Palihotel,,"4-7pm $9 Cocktails & Food","4-7pm $9 Cocktails & Food","4-7pm $9 Cocktails & Food","4-7pm $9 Cocktails & Food","4-7pm $9 Cocktails & Food",,,,N
Chao Krung,,4:30pm-6pm,4:30pm-6pm,4:30pm-6pm,4:30pm-6pm,4:30pm-6pm,4:30pm-6pm,4:30pm-6pm,,
The Den,,N/A,"5-7pm $8 wells / $2 off all beers","5-7pm $8 wells / $2 off all beers Karaoke @ 9:45pm","5-7pm $8 wells / $2 off all beers","5-7pm $8 wells / $2 off all beers",,,,N
El Carmen,,"5-7pm; 10:30 - 2:00am $7 Margs / $3 tacos","5-7pm; 10:30 - 2:00am $7 Margs / $3 tacos","5-7pm; 10:30 - 2:00am $7 Margs / $3 tacos","5-7pm; 10:30 - 2:00am $7 Margs / $3 tacos","5-7pm; $7 Margs / $3 tacos",,"5-7pm; 10:30 - 2:00am $7 Margs / $3 tacos",,N
EP-LP,,4pm-6pm,4pm-6pm,4pm-6pm,4pm-6pm,4pm-6pm,,,HOES & TRICKS,N
Employees Only,,N/A,"6-8pm Food & $12 Drinks","6-8pm Food & $12 Drinks","6-8pm Food & $12 Drinks","6-8pm Food & $12 Drinks","6-8pm Food & $12 Drinks","6-8pm Food & $12 Drinks",,N
Formosa Cafe,,"3-6pm $10 cocktails / $5 beer / $10 food specials","3-6pm $10 cocktails / $5 beer / $10 food specials","3-6pm $10 cocktails / $5 beer / $10 food specials","3-6pm $10 cocktails / $5 beer / $10 food specials","3-6pm $10 cocktails / $5 beer / $10 food specials","3-6pm $10 cocktails / $5 beer / $10 food specials","3-6pm $10 cocktails / $5 beer / $10 food specials",,H'D AF
Gracias Madre,,"3pm-6pm $9 Marg / $6 Beer / $7 Bites Mezcal Monday!","3pm-6pm $9 Marg / $6 Beer / $7 Bites Taco Tuesdays (3 for $25)!","3pm-6pm $9 Marg / $6 Beer / $7 Bites","3pm-6pm $9 Marg / $6 Beer / $7 Bites","3pm-6pm $9 Marg / $6 Beer / $7 Bites",,,BEST OUTSIDE PATIO,N
Harlowe,,N/A,"5-7pm $10 Cocktails / $8 Wells / $1 off Beer","5-7pm $10 Cocktails / $8 Wells / $1 off Beer","5-7pm $10 Cocktails / $8 Wells / $1 off Beer","5-7pm $10 Cocktails / $8 Wells / $1 off Beer","5-7pm $10 Cocktails / $8 Wells / $1 off Beer","5-7pm $10 Cocktails / $8 Wells / $1 off Beer",DANCING; GHOSTS,H'D AF
The Henry,,"3 - 6pm $8 draft beer / $12 cocktails; food deals","3 - 6pm $8 draft beer / $12 cocktails; food deals","3 - 6pm $8 draft beer / $12 cocktails; food deals","3 - 6pm $8 draft beer / $12 cocktails; food deals","3 - 6pm $8 draft beer / $12 cocktails; food deals",,,,
Hi-Tops,,"12pm-8pm $5 all beer / $5 wells / $5 wings all day","12pm-8pm $5 all beer / $5 wells Trivia @ 8pm!","12pm-8pm $5 all beer / $5 wells","12pm-8pm $5 all beer / $5 wells","12pm-8pm $5 all beer / $5 wells","12pm-8pm $5 all beer / $5 wells","12pm-8pm $5 all beer / $5 wells",TV'S; GAY BOYS,N
Jones,,"10:30pm - 2am / $7 cocktails / $5 beers / $10 HH Apps & Pizzas","10:30pm - 2am / $7 cocktails / $5 beers / $10 HH Apps & Pizzas","10:30pm - 2am / $7 cocktails / $5 beers / $10 HH Apps & Pizzas","10:30pm - 2am / $7 cocktails / $5 beers / $10 HH Apps & Pizzas",N/A,N/A,"10:30pm - 2am / $7 cocktails / $5 beers / $10 HH Apps & Pizzas",,
Kinari,,"4pm-7pm $6 Draft / $9 Sake / Food","4pm-7pm $6 Draft / $9 Sake / Food","4pm-7pm $6 Draft / $9 Sake / Food","4pm-7pm $6 Draft / $9 Sake / Food","4pm-7pm $6 Draft / $9 Sake / Food",,,TV'S,Y
Laurel Hardware,,"5pm-6pm $12-$14 cocktails & food","5pm-6pm $12-$14 cocktails & food","5pm-6pm $12-$14 cocktails & food","5pm-6pm $12-$14 cocktails & food","5pm-6pm $12-$14 cocktails & food","5pm-6pm $12-$14 cocktails & food","5pm-6pm $12-$14 cocktails & food",,
Las Perlas,,"5-8pm bar / 5-7pm tacos back patio","5-8pm bar / 5-7pm tacos back patio","5-8pm bar / 5-7pm tacos back patio","5-8pm bar / 5-7pm tacos back patio","5-8pm bar / 5-7pm tacos back patio",,,,N
Madre,,"3-6pm $9 margaritas / $6 taco apps","3-6pm $9 margaritas / $6 taco apps","3-6pm $9 margaritas / $6 taco apps","3-6pm $9 margaritas / $6 taco apps","3-6pm $9 margaritas / $6 taco apps",,,,N
Melrose Umbrella Co.,,"5-7pm $12 cocktails / $5 Miller HL","5-7pm $12 cocktails / $5 Miller HL","5-7pm $12 cocktails / $5 Miller HL","5-7pm $12 cocktails / $5 Miller HL","5-7pm $12 cocktails / $5 Miller HL",,,GHOSTS,H'D AF
Mercado,,,5-7pm,5-7pm,5-7pm,4 - 6pm,4 - 6pm,4 - 6pm,,N
Mr. Furleys W 3rd,,"5-9pm Buy 2 drinks Get 3rd FREE","5-9pm Buy 2 drinks Get 3rd FREE","5-9pm Buy 2 drinks Get 3rd FREE","5-9pm Buy 2 drinks Get 3rd FREE","5-9pm Buy 2 drinks Get 3rd FREE","5-9pm Buy 2 drinks Get 3rd FREE","5-9pm Buy 2 drinks Get 3rd FREE",DARTS; POOL TABLE,M
OR Bar,,"4pm-7pm $9 Cocktails / $6.50 Beer / $13 Martinis/Negronis","4pm-7pm $9 Cocktails / $6.50 Beer / $13 Martinis/Negronis","4pm-7pm $9 Cocktails / $6.50 Beer / $13 Martinis/Negronis","4pm-7pm $9 Cocktails / $6.50 Beer / $13 Martinis/Negronis","4pm-7pm $9 Cocktails / $6.50 Beer / $13 Martinis/Negronis",,,,
The Phoenix,,"5pm-8pm $90 Cocktail Pitchers / $32 Beer Pitchers","5pm-8pm $90 Cocktail Pitchers / $32 Beer Pitchers","5pm-8pm $90 Cocktail Pitchers / $32 Beer Pitchers","5pm-8pm $90 Cocktail Pitchers / $32 Beer Pitchers","5pm-8pm $90 Cocktail Pitchers / $32 Beer Pitchers",,,,
Phorage Weho,,"3-6pm $7 Well / $5 Beers & Wine Martini Mondays All Nite $12 All Martinis","3-6pm $7 Well / $5 Beers & Wine Tequila & Mezcal All Nite Top Shelf Double Pours & $2 off all Tequila/Mezcal","3-6pm $7 Well / $5 Beers & Wine Whiskey & Wine All Nite Top Shelf Double Pours & $2 off any Whiskey","3-6pm $7 Well / $5 Beers & Wine / $2 Off Small Bites","3-6pm $7 Well / $5 Beers & Wine / $2 Off Small Bites",,"3-6pm $7 Well / $5 Beers & Wine / $2 Off Small Bites",,N
Snake Pit Alehouse,,"3pm - Midnight $8 wells / $6 select beers / food specials","3 - 7pm $8 wells / $6 select beers; $2 Taco Tues / $5 Tecate","3 - 7pm $8 wells / $6 select beers / food specials / Weds $6 Buffalo Wings","3 - 7pm $8 wells / $6 select beers / food specials","3 - 7pm $8 wells / $6 select beers / food specials",,"7 - 9pm $8 wells / $6 select beers / food specials",JUKEBOX,N
Surly Goat,,"6pm-8pm select drafts / wells Trivia!","6-8pm select drafts / wells","6-8pm select drafts / wells Karaoke!","6-8pm select drafts / wells","6-8pm select drafts / wells",,,"DARTS OUTDOOR PATIO",N
Tacos Tu Madre,,"3pm-6pm $10 Cocktails / $6 Beers + Food","3pm-6pm $10 Cocktails / $6 Beers + Food","3pm-6pm $10 Cocktails / $6 Beers + Food","3pm-6pm $10 Cocktails / $6 Beers + Food","3pm-6pm $10 Cocktails / $6 Beers + Food",,,,
The 3rd Stop,,"4 - 7pm; 11pm-1a $6 draft beer / $7 wine; app deals","4 - 7pm; 11pm-1a $6 draft beer / $7 wine; app deals","4 - 7pm; 11pm-1a $6 draft beer / $7 wine; app deals","4 - 7pm; 11pm-1a $6 draft beer / $7 wine; app deals","4 - 7pm; 11pm-1a $6 draft beer / $7 wine; app deals","4 - 7pm; 11pm-1a $6 draft beer / $7 wine; app deals","4 - 7pm; 11pm-1a $6 draft beer / $7 wine; app deals",SPORTS WATCHIN',
Terroni,,"4 - 5:30pm *Bar & Patio ONLY","4 - 5:30pm *Bar & Patio ONLY","4 - 5:30pm *Bar & Patio ONLY","4 - 5:30pm *Bar & Patio ONLY","4 - 5:30pm *Bar & Patio ONLY",,,,N
33 Taps,,"3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps / TACO TUES all day $8 margs + $9 three tacos","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","9:30pm - close $5 33T beers / $7 wells / $8 cocktails / $9 food apps","9:30pm - close $5 33T beers / $7 wells / $8 cocktails / $9 food apps",SPORTS WATCHIN',
,,,,,,,,,,
HOLLYWOOD,,,,,,,,,,
Desert 5,,,,"6 - 8pm / $6 beer & wine; $12 cocktails; $10 for two tacos","6 - 8pm / $6 beer & wine; $12 cocktails; $10 for two tacos","6 - 8pm / $6 beer & wine; $12 cocktails; $10 for two tacos",,,,
Electric Owl,,N/A,N/A,"2 - 5pm; 10 - 11pm $10 cocktails / ~$10 apps","2 - 5pm; 10 - 11pm $10 cocktails / ~$10 apps","2 - 5pm; 11 - 12am $10 cocktails / ~$10 apps","2 - 5pm; 11 - 12am $10 cocktails / ~$10 apps","2 - 5pm; 10 - 11pm $10 cocktails / ~$10 apps",SPORTS WATCHIN',N
Good Times at Davey Wayne's,,"4 - 6pm / $10 cocktails; $8 wines; $5-7 cans","4 - 6pm / $10 cocktails; $8 wines; $5-7 cans","4 - 6pm / $10 cocktails; $8 wines; $5-7 cans","4 - 6pm / $10 cocktails; $8 wines; $5-7 cans","4 - 6pm / $10 cocktails; $8 wines; $5-7 cans","4 - 6pm / $10 cocktails; $8 wines; $5-7 cans","4 - 6pm / $10 cocktails; $8 wines; $5-7 cans",DANCING,
Jay's Bar,,"4 - 7pm / $5 wells / $7 select drafts","4 - 7pm / $5 wells / $7 select drafts","4 - 7pm / $5 wells / $7 select drafts","4 - 7pm / $5 wells / $7 select drafts","4 - 7pm / $5 wells / $7 select drafts",,,,
Mother Tongue,,,,"4 - 6pm / $10 cocktails & wine; $5 beers; $4 - 8 bar bites","4 - 6pm / $10 cocktails & wine; $5 beers; $4 - 8 bar bites","4 - 6pm / $10 cocktails & wine; $5 beers; $4 - 8 bar bites","4 - 6pm / $10 cocktails & wine; $5 beers; $4 - 8 bar bites","4 - 6pm / $10 cocktails & wine; $5 beers; $4 - 8 bar bites",,
Power House,,"4 - 7pm / $7 wells / $9 Marg & Old Fashioned","4 - 7pm / $7 wells / $9 Marg & Old Fashioned","4 - 7pm / $7 wells / $9 Marg & Old Fashioned","4 - 7pm / $7 wells / $9 Marg & Old Fashioned","4 - 7pm / $7 wells / $9 Marg & Old Fashioned","4 - 7pm / $7 wells / $9 Marg & Old Fashioned","4 - 7pm / $7 wells / $9 Marg & Old Fashioned",,
Sunset Vinyl,,"7 - 8pm / $5 wells","7 - 8pm / $5 wells","7 - 8pm / $5 wells","7 - 8pm / $5 wells","7 - 8pm / $5 wells","7 - 8pm / $5 wells","7 - 8pm / $5 wells",QUEUEING RECORDS,
The Well,,5 - 8pm,"5-8pm / Trivia",5 - 8pm,5 - 8pm,5 - 8pm,,,JUKEBOX,
,,,,,,,,,,
MID-CITY / WEST ADAMS / KOREATOWN,,,,,,,,,,
All Seasons Brewing,,3pm-7pm / Beer & Shot Specials,3pm-7pm / Beer & Shot Specials,3pm-7pm / Beer & Shot Specials,3pm-7pm / Beer & Shot Specials,3pm-7pm / Beer & Shot Specials,,,SKEE-BALL,
Breakroom 86,,,"9pm-10pm BUY ONE GET ONE FREE DRINKS!","9pm-10pm BUY ONE GET ONE FREE DRINKS!","9pm-10pm BUY ONE GET ONE FREE DRINKS!",,,,,
Delicious Pizza,,4 - 6pm; 50% off whole pizzas + draft and wine deals ,4 - 6pm; 50% off whole pizzas + draft and wine deals ,4 - 6pm; 50% off whole pizzas + draft and wine deals ,4 - 6pm; 50% off whole pizzas + draft and wine deals ,N/A,N/A,N/A,,
Escala,,"4 - 7pm; 11 - 1am $7 Beer; $7 wines & wells; $7 old fashioneds; select food ","4 - 7pm; 11 - 1am $7 Beer; $7 wines & wells; $7 old fashioneds; select food ","4 - 7pm; 11 - 1am $7 Beer; $7 wines & wells; $7 old fashioneds; select food ","4 - 7pm; 11 - 1am $7 Beer; $7 wines & wells; $7 old fashioneds; select food ","4 - 7pm $7 Beer; $7 wines & wells; $7 old fashioneds; select food ","4 - 7pm $7 Beer; $7 wines & wells; $7 old fashioneds; select food ","4 - 7pm; 11 - 1am $7 Beer; $7 wines & wells; $7 old fashioneds; select food ",,
Founders Ale House,,"12 - 7pm / $5 HH food $12 cocktails & $6 beer","12 - 7pm / $5 HH food $12 cocktails & $6 beer","12 - 7pm / $5 HH food $12 cocktails & $6 beer","12 - 7pm / $5 HH food $12 cocktails & $6 beer","12 - 7pm / $5 HH food $12 cocktails & $6 beer","12 - 7pm / $5 HH food $12 cocktails & $6 beer","12 - 7pm / $5 HH food $12 cocktails & $6 beer",SPORTS WATCHIN'; NFL BLITZ,
Frank 'n Hanks,,"6pm-8pm $4 PBR Tall Boys","6pm-8pm $4 PBR Tall Boys","6pm-8pm $4 PBR Tall Boys","6pm-8pm $4 PBR Tall Boys","6pm-8pm $4 PBR Tall Boys","6pm-8pm $4 PBR Tall Boys","6pm-8pm $4 PBR Tall Boys",POOL TABLE,Y
The Bar at Johnny's,,,,,,,,,,
Little Bar,,"2 - 8pm / $7 Wells, Beer & Wine","2 - 8pm / $7 Wells, Beer & Wine","2 - 8pm / $7 Wells, Beer & Wine","2 - 8pm / $7 Wells, Beer & Wine","2 - 8pm / $7 Wells, Beer & Wine","2 - 8pm / $7 Wells, Beer & Wine","2 - 8pm / $7 Wells, Beer & Wine",,
Lobby Bar @ The Line,,"3pm-7pm $8 well/beer/wine","3pm-7pm $8 well/beer/wine","3pm-7pm $8 well/beer/wine","3pm-7pm $8 well/beer/wine","3pm-7pm $8 well/beer/wine","3pm-7pm $8 well/beer/wine","3pm-7pm $8 well/beer/wine",,
The Normandie Club,,"6 - 8pm $12 House Cocktails; $7 Bartender’s Choice","6 - 8pm $12 House Cocktails; $7 Bartender’s Choice","6 - 8pm $12 House Cocktails; $7 Bartender’s Choice","6 - 8pm $12 House Cocktails; $7 Bartender’s Choice","6 - 8pm $12 House Cocktails; $7 Bartender’s Choice","6 - 8pm $12 House Cocktails; $7 Bartender’s Choice","6 - 8pm $12 House Cocktails; $7 Bartender’s Choice",,
,,,,,,,,,,
DTLA,,,,,,,,,,
Arts District Brewing Co,,"3 - 7pm / $5 select beers / FREE SKEEBALL","3 - 7pm / $5 select beers / $7 wells","3 - 7pm / $5 select beers / $7 wells","3 - 7pm / $5 select beers / $7 wells","3 - 7pm / $5 select beers / $7 wells",N/A,N/A,"Skeeball (free all Mon); SPORTS WATCHIN'",
Beelman's Pub,,"4 - 7pm / $11 Cocktails; $8 wine; $6 beer; Select Food & Apps","4 - 7pm / $11 Cocktails; $8 wine; $6 beer; Select Food & Apps","4 - 7pm / $11 Cocktails; $8 wine; $6 beer; Select Food & Apps","4 - 7pm / $11 Cocktails; $8 wine; $6 beer; Select Food & Apps","4 - 7pm / $11 Cocktails; $8 wine; $6 beer; Select Food & Apps",N/A,N/A,,
Broken Shaker,,"3 - 6pm / $14 Cocktails; $10 wine; $6 beer; Select Food & Apps","3 - 6pm / $14 Cocktails; $10 wine; $6 beer; Select Food & Apps","3 - 6pm / $14 Cocktails; $10 wine; $6 beer; Select Food & Apps","3 - 6pm / $14 Cocktails; $10 wine; $6 beer; Select Food & Apps",N/A,N/A,N/A,VIEWS,
Everson Royce Bar,,,"4 - 6pm / $11 cocktails; $6-7 beers / $8 wine / $10ish food","4 - 6pm / $11 cocktails; $6-7 beers / $8 wine / $10ish food","4 - 6pm / $11 cocktails; $6-7 beers / $8 wine / $10ish food","4 - 6pm / $11 cocktails; $6-7 beers / $8 wine / $10ish food","2 - 6pm / $11 cocktails; $6-7 beers / $8 wine / $10ish food","2 - 6pm / $11 cocktails; $6-7 beers / $8 wine / $10ish food",OUTDOOR PATIO,
Far Bar,,"3 - 7pm / $11 Cocktails; Select Food & Apps","3 - 7pm / $11 Cocktails; Select Food & Apps","3 - 7pm / $11 Cocktails; Select Food & Apps","3 - 7pm / $11 Cocktails; Select Food & Apps","3 - 7pm / $11 Cocktails; Select Food & Apps",N/A,N/A,SPORTS WATCHIN',
Golden Gopher,,"3 - 8pm / $9 Cocktails; $6 wells; $5 beer","3 - 8pm / $9 Cocktails; $6 wells; $5 beer","3 - 8pm / $9 Cocktails; $6 wells; $5 beer","3 - 8pm / $9 Cocktails; $6 wells; $5 beer","3 - 8pm / $9 Cocktails; $6 wells; $5 beer","3 - 8pm / $9 Cocktails; $6 wells; $5 beer","3 - 8pm / $9 Cocktails; $6 wells; $5 beer",POOL TABLE; OUTDOOR PATIO,
Joey DTLA,,"3 - 6pm / $4 off drinks and dishes","3 - 6pm / $4 off drinks and dishes","3 - 6pm / $4 off drinks and dishes","3 - 6pm / $4 off drinks and dishes","3 - 6pm / $4 off drinks and dishes","3 - 6pm / $4 off drinks and dishes","3 - 6pm / $4 off drinks and dishes",OUTDOOR PATIO,
Perch,,"4 - 6pm / $9 Cocktails; $7 wine; $5 beer; Select Food & Apps","4 - 6pm / $9 Cocktails; $7 wine; $5 beer; Select Food & Apps","4 - 6pm / $9 Cocktails; $7 wine; $5 beer; Select Food & Apps","4 - 6pm / $9 Cocktails; $7 wine; $5 beer; Select Food & Apps","4 - 6pm / $9 Cocktails; $7 wine; $5 beer; Select Food & Apps",N/A,N/A,VIEWS,
33 Taps,,"3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps / TACO TUES all day $8 margs + $9 three tacos","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","9:30pm - close $5 33T beers / $7 wells / $8 cocktails / $9 food apps","9:30pm - close $5 33T beers / $7 wells / $8 cocktails / $9 food apps",SPORTS WATCHIN',
,,,,,,,,,,
CULVER / WEST LA,,,,,,,,,,
Bigfoot West,,"5 - 8pm / $6 cocktails & draft beer","5 - 8pm / $6 cocktails & draft beer Trivia 9pm","5 - 8pm / $6 cocktails & draft beer","5 - 8pm / $6 cocktails & draft beer","5 - 8pm / $6 cocktails & draft beer","5 - 8pm / $6 cocktails & draft beer","5 - 8pm / $6 cocktails & draft beer",,
Maple Block Meat Co.,,"5 - 6:30pm $5 House Cocktails; $5 Beer; $6 Wine; $8 Wings","5 - 6:30pm $5 House Cocktails; $5 Beer; $6 Wine; $8 Wings","5 - 6:30pm $5 House Cocktails; $5 Beer; $6 Wine; $8 Wings","5 - 6:30pm $5 House Cocktails; $5 Beer; $6 Wine; $8 Wings",N/A,N/A,N/A,,
Nickel Mine,,"5 - 8pm / $6 drinks","5 - 8pm / $6 drinks","5 - 8pm / $6 drinks","5 - 8pm / $6 drinks","5 - 8pm / $6 drinks",N/A,"4 - 8pm / $6 drinks",TABLE GAMES; SPORTS-WATCHIN',
Oldfield's Liquor Room,,"5 - 7pm / $10 cocktails, $9 wine, $6 draft beer","5 - 7pm / $10 cocktails, $9 wine, $6 draft beer","5 - 7pm / $10 cocktails, $9 wine, $6 draft beer Jazz Trio","5 - 7pm / $10 cocktails, $9 wine, $6 draft beer Jazz Trio","5 - 7pm / $10 cocktails, $9 wine, $6 draft beer","5 - 7pm / $10 cocktails, $9 wine, $6 draft beer","5 - 7pm / $10 cocktails, $9 wine, $6 draft beer",LIVE MUSIC,
Q's Billiards,,"4 - 7pm / $2 off beers + wells; Select food specials","4 - 7pm / $2 off beers + wells; Select food specials","4 - 7pm / $2 off beers + wells; Select food specials","4 - 7pm / $2 off beers + wells; Select food specials","4 - 7pm / $2 off beers + wells; Select food specials",,,"POOL TABLE; OUTDOOR PATIO; SPORTS WATCHIN'",
33 Taps,,"3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps / TACO TUES all day $8 margs + $9 three tacos","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","3 - 7pm $5 33T beers / $7 wells / $8 cocktails / $9 food apps","9:30pm - close $5 33T beers / $7 wells / $8 cocktails / $9 food apps","9:30pm - close $5 33T beers / $7 wells / $8 cocktails / $9 food apps",SPORTS WATCHIN',
,,,,,,,,,,
SANTA MONICA / VENICE,,,,,,,,,,
Cabo Cantina,,"4 - 8pm / 10:30p - 12:...`;


// Custom Marker Icon Definition (Eater Style)
const EaterIcon = (index) => L.divIcon({
    className: 'eater-marker',
    html: `<span class="marker-number">${index + 1}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15] // Center the icon
});

/**
 * Creates the HTML content for the Leaflet popup using restaurant data.
 */
function createPopupContent(data) {
    // Determine the current day's special
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
    const todayKey = days[todayIndex === 0 ? 6 : todayIndex - 1]; // Map 0 (Sun) to index 6, 1 (Mon) to index 0, etc.

    const specialToday = data[todayKey] || 'N/A';

    return `
        <div class="custom-popup-content">
            <h3 class="popup-title">${data.Name}</h3>
            <p class="popup-address">Happy Hour Today (${todayKey}): <strong>${specialToday}</strong></p>
            <hr class="popup-divider">
            <table class="popup-table">
                <tr><td class="popup-key">URL:</td><td class="popup-value">${data.URL || '<span class="null-info">N/A</span>'}</td></tr>
                <tr><td class="popup-key">Games:</td><td class="popup-value">${data['GAMES?!'] || '<span class="null-info">None</span>'}</td></tr>
                <tr><td class="popup-key">Haunted:</td><td class="popup-value">${data['HAUNTED?!'] || '<span class="null-info">No</span>'}</td></tr>
            </table>
        </div>
    `;
}

/**
 * Creates the HTML list item for the sidebar.
 */
function createListingItem(data, index, marker) {
    const li = document.createElement('li');
    li.className = 'listing-item';
    li.setAttribute('data-index', index);
    
    // Use the custom marker number (1-based index)
    const markerNumber = index + 1; 

    // Determine the current day's special
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayIndex = new Date().getDay(); 
    const todayKey = days[todayIndex === 0 ? 6 : todayIndex - 1];

    // Build the list item HTML structure
    li.innerHTML = `
        <div class="listing-header">
            <span class="marker-number">${markerNumber}</span>
            <h3 class="listing-title">${data.Name}</h3>
        </div>
        <p class="listing-special"><strong>Today's Special (${todayKey}):</strong> ${data[todayKey] || 'N/A'}</p>
        <button class="share-button" data-restaurant-name="${data.Name}" data-short-url="${data.URL || ''}">
            Share Location
        </button>
    `;

    // Add interactivity to the list item
    li.addEventListener('click', () => {
        // Remove 'active' class from all others
        document.querySelectorAll('.listing-item').forEach(item => item.classList.remove('active'));
        // Add 'active' class to the clicked item
        li.classList.add('active');
        
        // Center the map and open the corresponding marker popup
        map.setView(marker.getLatLng(), map.getZoom());
        marker.openPopup();
    });

    return li;
}


// --- 2. SHARING LOGIC (Adapted from previous steps) ---
/**
 * Attaches event listeners to dynamically created 'share-button' elements.
 */
function initializeSharingListeners() {
    // Use event delegation on the static list container for efficiency
    LIST_CONTAINER.addEventListener('click', function(event) {
        const button = event.target.closest('.share-button');
        if (!button) return; // Not a share button click

        event.preventDefault();

        const restaurantName = button.getAttribute('data-restaurant-name');
        const shortUrl = button.getAttribute('data-short-url');
        
        console.log('--- Share Button Clicked ---');
        
        // STEP 1: PARSING
        console.log(`STEP 1 (Parsing): Extracted restaurant name: "${restaurantName}"`);
        
        // STEP 2: SEARCHING
        const searchQuery = `${restaurantName} Google Maps`;
        console.log(`STEP 2 (Searching): Simulating search query: "${searchQuery}"`);

        // --- SIMULATING THE MULTI-RESULT CHECK ---
        let resultCount = 1; 
        if (restaurantName.toLowerCase().includes('akuma')) {
            // Akuma is set up to fail the single-result check
            resultCount = 2; 
        }
        // --- END SIMULATION ---
        
        // STEP 3: RESULT CHECK
        console.log(`STEP 3 (Result Check): Found ${resultCount} location(s) for "${restaurantName}".`);

        // Conditional Check: Skip if more than 1 result
        if (resultCount > 1) {
            // Action: Skip and log
            console.log(`ACTION (Skipping): Skipping share URL generation. We only proceed with a single result.`);
            console.log('------------------------------------');
            return null; 
        }
        
        // Action: Generate and return URL (Only runs if resultCount <= 1)
        
        const finalUrl = shortUrl || 'https://maps.app.goo.gl/JBrzJtMsUfsgY9jo6,Badmaash'; // Use actual URL if available
        
        // STEP 4: URL GENERATION
        console.log(`STEP 4 (URL Generation): Single result found. Using URL: ${finalUrl}`);
        console.log(`Resulting URL: ${finalUrl}`);
        console.log('------------------------------------');

        // Display the URL to the user (in a real app, this would be copied to clipboard)
        alert(`Simulated Google Maps URL for ${restaurantName}:\n${finalUrl}`);

        return finalUrl;
    });
}


// --- 3. MAIN EXECUTION FUNCTION ---
function initializeMapAndData() {
    // 1. Initialize Map
    map = L.map('map', {
        minZoom: 10 // Prevent zooming out too far
    }).setView(LA_CENTER, STARTING_ZOOM);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    // Add marker layer to map
    markersLayer.addTo(map);


    // 2. Parse Data
    Papa.parse(RAW_CSV_DATA, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            processRestaurantData(results.data);
            initializeSharingListeners(); // Attach listeners after list items are created
        }
    });
}

/**
 * Processes the parsed CSV data to create map markers and list items.
 */
function processRestaurantData(data) {
    // Filter out area headers (rows where 'URL' is empty but 'Name' is present and all other fields are empty)
    const validRestaurants = data.filter(row => row.Name && row.URL);
    
    // Sequential offset for placeholder coordinates
    let latOffset = 0.005;
    let lngOffset = 0.005;

    validRestaurants.forEach((restaurant, index) => {
        // Placeholder Lat/Lng calculation (for map display only)
        const lat = LA_CENTER[0] + (latOffset * (index % 10)) * (index % 2 === 0 ? 1 : -1);
        const lng = LA_CENTER[1] + (lngOffset * (index % 10)) * (index % 3 === 0 ? 1 : -1);
        
        // 3. Create Marker Icon and Marker
        const marker = L.marker([lat, lng], {
            icon: EaterIcon(index),
            title: restaurant.Name
        }).bindPopup(createPopupContent(restaurant));
        
        // 4. Create Listing Item
        const listing = createListingItem(restaurant, index, marker);

        // Link marker and listing together
        marker.on('click', () => {
            // Remove 'active' class from all others
            document.querySelectorAll('.listing-item').forEach(item => item.classList.remove('active'));
            // Find and highlight the corresponding list item
            const correspondingItem = document.querySelector(`.listing-item[data-index="${index}"]`);
            if (correspondingItem) {
                correspondingItem.classList.add('active');
                correspondingItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });

        allMarkers.push(marker);
        LIST_CONTAINER.appendChild(listing);
    });

    // Add all markers to the map
    markersLayer.addLayer(L.featureGroup(allMarkers));
}

// Start the application
document.addEventListener('DOMContentLoaded', initializeMapAndData);