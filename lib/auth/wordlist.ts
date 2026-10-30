/**
 * Kurze deutsche Wörter ohne Umlaute – leicht zu schreiben, schwer zu verwechseln.
 * 12 Wörter aus 283 = rund 97 Bit Zufall. Gespeichert wird nur ein Argon2id-Hash.
 */
export const WORDS = (
  'abend acker adler ahorn ameise amsel anker apfel arm asche ast atem ' +
  'bach backe bahn ball band bank bart bauer baum beere berg besen biber biene bild birke ' +
  'blatt blitz blume boden bogen boot brett brief brot bruecke brunnen buch bucht burg busch butter ' +
  'dach dachs damm decke deich delfin docht dorf draht drache duft duene ' +
  'eber efeu eiche eimer eis elch ente erbse erde esel eule ' +
  'fabel fackel faden falke farbe farn feder fee feld fels fenster ferne fest feuer fichte fink ' +
  'fisch flamme flocke floh flur fluss fohlen forelle frosch fuchs funke ' +
  'gabel gans garten gast geige gipfel glas glocke gold gras grille grotte gurke ' +
  'hafen hafer hagel hahn halm hammer hand hase hecht hecke heide herbst herz heu himmel hirsch ' +
  'hoehle holz honig horn huegel hummel hut ' +
  'igel insel ' +
  'jacke jahr ' +
  'kahn kamm kanne karte kater kerze kiesel kirsche kiste klee knopf koffer kohle korb krabbe ' +
  'kranich kreide krone kuchen kugel ' +
  'lachs lager lampe land laterne laub lerche licht linde loewe loeffel luchs luft ' +
  'maus meer meise melone milch mond moos moewe muehle muschel ' +
  'nacht nadel nebel nest netz nuss ' +
  'oase ofen ohr orgel otter ' +
  'paket palme papier pfad pfeil pferd pflaume pilz pinsel platz pollen post puppe ' +
  'quelle quark ' +
  'rabe rad rahmen raupe regen reh reise rinde ring rose ruder ' +
  'saat sack salz sand schaf schal schiff schnee see segel seil sense sichel sieb silber sommer ' +
  'sonne spatz specht spiegel stein stern stirn storch strand stroh stuhl sumpf ' +
  'tal tanne tasche tau teich teller tiger tinte tisch topf traum tulpe turm ' +
  'ufer uhr ulme ' +
  'vase vogel ' +
  'wabe wagen wald wal wand wasser weide weizen welle wiese wind winter wolke wurzel ' +
  'zange zaun zebra zelt zimt zitrone zucker zweig zwerg'
).split(' ')
