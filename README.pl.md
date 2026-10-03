[English](README.md) | [Deutsch](README.de.md) | [Polski](README.pl.md)

# ioBroker.heiko

**Wersja: `0.13.2`**

Adapter ioBroker do pomp ciepła HEIKO z modułem TCP W600. To osobny projekt ioBroker, nie integracja Home Assistant.

Projekt powstał z pomocą AI w podejściu vibe-coding. Informacje o wykonanych testach, sprzęcie i ograniczeniach znajdują się w dokumentacji.

## Możliwości

- Temperatury, częstotliwość sprężarki, stan pomp i wentylatorów oraz efektywna zadana temperatura zasilania.
- Włączanie/wyłączanie, wybór trybu pracy i zmiana zadanych temperatur przez lokalne połączenie W600.
- 128 potwierdzonych parametrów; zapis parametrów zapisywalnych z kontrolą zakresu i potwierdzeniem odczytem zwrotnym.
- Opcjonalne dwukierunkowe przekazywanie danych do MyHeatPump, ponowne połączenia i diagnostyka.
- Bez dodatkowego kontenera ani mostu MQTT.

## Wymagania i zgodność

Node.js 20 lub nowszy, js-controller co najmniej 6.0.11 i Admin co najmniej 7.6.20. Szczegółowe wersje faktycznie przetestowane opisano w [raporcie walidacji](docs/validation.md).

Praca na rzeczywistym sprzęcie została potwierdzona dla HEIKO THERMAL 12 z W600. Nie gwarantuje to zgodności każdego modelu ani firmware. Testy symulowane nie zastępują testów fizycznego urządzenia. Znaczenie niepotwierdzonych danych nie jest zgadywane.

## Instalacja

1. Pobierz `iobroker.heiko-0.13.2.tgz` i `SHA256SUMS` z [wydania v0.13.2](https://github.com/Zorax24/ioBroker.heiko/releases/tag/v0.13.2).
2. Sprawdź sumę SHA-256 i umieść pakiet w katalogu projektu kontrolera ioBroker.
3. Zainstaluj lokalny pakiet, a następnie dodaj instancję:

```bash
npm install --omit=dev ./iobroker.heiko-0.13.2.tgz
iobroker upload heiko
iobroker add heiko
```

Przy aktualizacji istniejącej instancji nie dodawaj kolejnej. Najpierw wykonaj kopię zapasową ioBroker i zapisz konfigurację. Aktualizacja aktywnego mostu wymaga krótkiego przerwania połączenia W600.

## Połączenie i konfiguracja

W600 działa jako klient TCP i łączy się z adapterem. Adapter nasłuchuje na skonfigurowanym adresie i porcie, a opcjonalnie łączy się z serwerem producenta. Nie są potrzebne porty otwarte z Internetu; używaj zaufanej sieci LAN lub VPN. TCP W600 nie jest szyfrowany.

1. W konfiguracji instancji wybierz adres nasłuchiwania i wolny port TCP, zwykle `8899`.
2. Zapisz dotychczasowy adres i port docelowy W600. W module ustaw tryb klienta TCP, adres LAN hosta ioBroker i port adaptera. Nie zmieniaj niepowiązanych ustawień modułu.
3. Uruchom instancję i sprawdź `info.connection`, `meta.last_seen` oraz aktualne pomiary przed włączeniem zapisu.

Każda instancja musi używać wolnego portu. Bezpośrednie sterowanie wymaga dokładnie jednego aktywnego połączenia W600, potwierdzonego kontekstu ramki i jawnego włączenia opcji zapisu bezpośredniego. Włączenie zapisu przez chmurę jest osobną opcją.

Wybierz język polski w ioBroker Admin. Nazwy, opisy, grupy parametrów i konfiguracja będą po polsku. Techniczne identyfikatory pozostają niezmienione: `Einstellungen.HeizKühlkreis1.KühlSolltemperatur` wyświetla się jako **Zadana temperatura chłodzenia**. Etykiety wyboru zawierają niemiecki, angielski i polski. Komunikaty diagnostyczne pozostają w dotychczasowym języku; tekst błędów chmury i systemu nie jest tłumaczony.

## Chmura producenta

`upstreamEnabled` włącza lub wyłącza transparentne przekazywanie w obu kierunkach. Domyślnie przekazywanie jest włączone; aktualizacja nie zmienia zapisanej konfiguracji. Przekazywany jest strumień protokołu urządzenia, w tym identyfikator modułu, pomiary, ustawienia i polecenia chmury.

Po wyłączeniu przekazywania adapter nie zestawia tego połączenia. Można korzystać z odczytu i sterowania lokalnego; automatyczne ACK bez serwera wymaga osobnego włączenia `autoAckWithoutUpstream` (domyślnie wyłączone). Oddzielny klient API chmury ma własne opcje. Przy aktywnym przekazywaniu polecenia producenta nie są filtrowane przez lokalne opcje zapisu.

## Dane i sterowanie

- `realtime`: dane bieżące. `realtime.Tuo` to temperatura zasilania, `realtime.Tui` temperatura powrotu, `realtime.Frequency` częstotliwość sprężarki.
- `status.effectiveFlowSetpoint`: aktualny efektywny cel regulatora. Przy aktywnej krzywej grzewczej nie należy mylić go ze stałym celem `control.heatingSetpoint`.
- `Einstellungen`: potwierdzony katalog ustawień. Parametry serwisowe i ochronne nie są zwykłymi nastawami codziennego użytkowania; zmieniaj je tylko ze znajomością instalacji i instrukcji producenta.
- `control.power`, `control.mode`, `control.heatingSetpoint`, `control.coolingSetpoint`, `control.hotWaterSetpoint`: codzienne sterowanie. Sprawdzaj `control.directWriteReady`, `control.lastResult` i `control.lastError`.

Nie wysyłaj równoczesnych poleceń. Sukces bezpośredniego zapisu oznacza zgodny świeży odczyt CMD02 z tego samego połączenia, nie fizyczny start sprężarki. `status.compressorDemand` jest wskaźnikiem wywnioskowanym, nie niezależnie potwierdzonym bitem żądania sprężarki. `-99` oznacza brak dostępnej wartości, nie zero. Surowe dane nie mają automatycznie potwierdzonego znaczenia.

## Rozwiązywanie problemów

| Objaw | Co sprawdzić |
| --- | --- |
| Brak połączenia | Tryb klienta W600, adres i port, trasę LAN/VPN, zaporę i wolny port adaptera. |
| Połączenie jest, dane stare | `meta.last_seen`, `meta.last_setparams` i CRC; samo TCP nie dowodzi świeżych danych. |
| Zapis odrzucony | Jawne włączenie zapisu, jedno połączenie W600, aktualny kontekst, dozwolony zakres i brak innego polecenia w toku. |
| Brak potwierdzenia zapisu | Nowy zgodny CMD02; nie traktuj samego wysłania jako sukcesu. |
| Inna temperatura zadana | Aktywna krzywa grzewcza i `status.effectiveFlowSetpoint`. |
| Chmura niedostępna | Opcje przekazywania i API, dostępność serwera, błędy upstream; lokalny odczyt może nadal działać. |

## Aktualizacja, usunięcie i zgłoszenia

Zachowaj poprzedni pakiet i kopię zapasową. Po aktualizacji lub przywróceniu sprawdź połączenie i aktualność danych. Przed usunięciem aktywnego mostu przywróć wcześniejszy cel W600, jeśli urządzenie korzystało z adaptera.

W [zgłoszeniu błędu](https://github.com/Zorax24/ioBroker.heiko/issues) podaj wersję adaptera, Node.js, kontrolera i Admin, objaw oraz zanonimizowany fragment logu. Usuń hasła, tokeny, MAC/MN, numery seryjne, adresy prywatne i dane konta. Nie udostępniaj surowych ramek ani kopii bazy bez kontroli danych prywatnych.

Szczegółowe dokumenty po angielsku: [sterowanie](docs/controls.md), [eksploatacja](docs/operations.md), [mapowanie](MAPPING.md), [walidacja](docs/validation.md), [historia zmian](CHANGELOG.md).

## Licencja

[MIT](LICENSE). Projekt nie jest zatwierdzony przez producenta. Zobacz [informacje o elementach zewnętrznych](THIRD_PARTY_NOTICES.md); licencja projektu nie udziela praw do znaków i materiałów producenta.
