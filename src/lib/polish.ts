// Polish display text only. Protocol values and existing object IDs remain unchanged.
const TEXT: Record<string, string> = {
    'Quick settings': 'Ustawienia podstawowe',
    'System information': 'Informacje o systemie',
    'Basic settings': 'Ustawienia ogólne',
    'User settings': 'Ustawienia użytkownika',
    'Heating/cooling circuit 1': 'Obieg grzewczy/chłodzący 1',
    'Heating/cooling circuit 2': 'Obieg grzewczy/chłodzący 2',
    'Anti-legionella function': 'Funkcja antylegionella',
    'Holiday mode': 'Tryb urlopowy',
    'Additional heat sources': 'Dodatkowe źródła ciepła',
    'Domestic hot water settings': 'Ustawienia ciepłej wody użytkowej',
    'Domestic hot water tank': 'Zasobnik ciepłej wody użytkowej',
    'Reduced heating mode': 'Tryb obniżonej temperatury ogrzewania',
    'Utility lockout and ECO': 'Blokada dostawcy energii i ECO',
    'Further options': 'Dodatkowe opcje',
    'Circulation pumps': 'Pompy obiegowe',
    'Screed drying': 'Wygrzewanie jastrychu',
    'Power on/off': 'Włącz/wyłącz',
    'Software version': 'Wersja oprogramowania',
    'Database version': 'Wersja bazy danych',
    'Operating mode': 'Tryb pracy',
    'Enable domestic hot water': 'Włącz ciepłą wodę użytkową',
    'Enable heating': 'Włącz ogrzewanie',
    'Enable cooling': 'Włącz chłodzenie',
    'Enable heating and cooling': 'Włącz ogrzewanie i chłodzenie',
    'Enable basic operating modes': 'Włącz podstawowe tryby pracy',
    'Outdoor temperature limit for heating enable': 'Granica temperatury zewnętrznej dla włączenia ogrzewania',
    'Outdoor temperature limit for cooling enable': 'Granica temperatury zewnętrznej dla włączenia chłodzenia',
    'Maximum duration at minimum compressor speed': 'Maksymalny czas przy minimalnej prędkości sprężarki',
    'Heating/cooling time schedule': 'Harmonogram ogrzewania/chłodzenia',
    'Water temperature switch-off differential': 'Różnica temperatury wody dla wyłączenia',
    'Water temperature switch-on differential': 'Różnica temperatury wody dla włączenia',
    'Compressor speed reduction differential': 'Różnica temperatury dla zmniejszenia prędkości sprężarki',
    'Cooling setpoint': 'Zadana temperatura chłodzenia',
    'Enable heating curve': 'Włącz krzywą grzewczą',
    'Room temperature influence on heating curve': 'Wpływ temperatury pokojowej na krzywą grzewczą',
    'Room heating setpoint': 'Zadana temperatura pokojowa dla ogrzewania',
    'Room cooling setpoint': 'Zadana temperatura pokojowa dla chłodzenia',
    'Fixed flow temperature setpoint without heating curve': 'Stała zadana temperatura zasilania bez krzywej grzewczej',
    'Minimum flow temperature': 'Minimalna temperatura zasilania',
    'Maximum flow temperature': 'Maksymalna temperatura zasilania',
    'Enable anti-legionella function': 'Włącz funkcję antylegionella',
    'Anti-legionella setpoint': 'Zadana temperatura antylegionella',
    'Anti-legionella hold time': 'Czas utrzymania temperatury antylegionella',
    'Maximum anti-legionella runtime': 'Maksymalny czas działania antylegionella',
    'Enable holiday mode': 'Włącz tryb urlopowy',
    'Domestic hot water temperature reduction in holiday mode': 'Obniżenie temperatury CWU w trybie urlopowym',
    'Heating water temperature reduction in holiday mode': 'Obniżenie temperatury wody grzewczej w trybie urlopowym',
    'Enable additional heat source for heating': 'Włącz dodatkowe źródło ciepła dla ogrzewania',
    'Heating additional heat source priority (HBH)': 'Priorytet dodatkowego źródła ogrzewania (HBH)',
    'Enable additional heat source for domestic hot water': 'Włącz dodatkowe źródło ciepła dla CWU',
    'Domestic hot water additional heat source priority (HWTBH)': 'Priorytet dodatkowego źródła CWU (HWTBH)',
    'External heat source start factor (delta T/time)':
        'Współczynnik uruchomienia zewnętrznego źródła ciepła (delta T/czas)',
    'HWTBH start interval': 'Interwał uruchamiania HWTBH',
    'Enable emergency operation': 'Włącz tryb awaryjny',
    'Domestic hot water setpoint': 'Zadana temperatura ciepłej wody użytkowej',
    'Domestic hot water switch-on differential': 'Różnica temperatury dla włączenia CWU',
    'Enable alternating priority': 'Włącz naprzemienny priorytet',
    'Outdoor temperature limit for alternating priority':
        'Granica temperatury zewnętrznej dla naprzemiennego priorytetu',
    'Minimum domestic hot water charging time': 'Minimalny czas ładowania CWU',
    'Maximum heating runtime': 'Maksymalny czas ogrzewania',
    'Permitted heating temperature deviation': 'Dopuszczalne odchylenie temperatury ogrzewania',
    'Enable alternating priority with HWTBH': 'Włącz naprzemienny priorytet z HWTBH',
    'Enable domestic hot water tank function': 'Włącz funkcję zasobnika CWU',
    'Enable reheat function': 'Włącz dogrzewanie',
    'Reheat setpoint': 'Zadana temperatura dogrzewania',
    'Reheat switch-on differential': 'Różnica temperatury dla włączenia dogrzewania',
    'Enable heating/cooling circuit 2': 'Włącz obieg grzewczy/chłodzący 2',
    'Cooling setpoint for circuit 2': 'Zadana temperatura chłodzenia obiegu 2',
    'Enable heating curve for circuit 2': 'Włącz krzywą grzewczą obiegu 2',
    'Fixed flow temperature setpoint for circuit 2': 'Stała zadana temperatura zasilania obiegu 2',
    'Maximum flow temperature for circuit 2': 'Maksymalna temperatura zasilania obiegu 2',
    'Minimum flow temperature for circuit 2': 'Minimalna temperatura zasilania obiegu 2',
    'Enable reduced heating setpoint': 'Włącz obniżoną temperaturę zadaną ogrzewania',
    'Setback/boost value': 'Wartość obniżenia/podwyższenia',
    'Enable sleep function': 'Włącz funkcję nocną',
    'Sleep function temperature deviation': 'Odchylenie temperatury funkcji nocnej',
    'Utility lockout switching logic': 'Logika przełączania blokady dostawcy energii',
    'Enable utility lockout': 'Włącz blokadę dostawcy energii',
    'HBH backup heater during utility lockout': 'Dodatkowe źródło HBH podczas blokady dostawcy energii',
    'Pump P0 during utility lockout': 'Pompa P0 podczas blokady dostawcy energii',
    'Display backlight': 'Podświetlenie wyświetlacza',
    'Pump P0 type': 'Typ pompy P0',
    'Pump P0 speed level': 'Poziom prędkości pompy P0',
    'Pump P0 operating mode': 'Tryb pracy pompy P0',
    'Pump P0 pause time in interval mode': 'Czas przerwy pompy P0 w trybie interwałowym',
    'Pump P0 runtime in interval mode': 'Czas pracy pompy P0 w trybie interwałowym',
    'Buffer tank present': 'Obecność zbiornika buforowego',
    'Enable mixing valve 1': 'Włącz zawór mieszający 1',
    'Enable mixing valve 2': 'Włącz zawór mieszający 2',
    'Pump P1 during heating': 'Pompa P1 podczas ogrzewania',
    'Pump P1 during cooling': 'Pompa P1 podczas chłodzenia',
    'Pump P1 with external signal': 'Pompa P1 przy sygnale zewnętrznym',
    'Pump P2 during heating': 'Pompa P2 podczas ogrzewania',
    'Pump P2 during cooling': 'Pompa P2 podczas chłodzenia',
    'Pump P2 with external signal': 'Pompa P2 przy sygnale zewnętrznym',
    'Enable screed drying': 'Włącz wygrzewanie jastrychu',
    'Current screed drying stage': 'Aktualny etap wygrzewania jastrychu',
    'Duration of current stage': 'Czas trwania aktualnego etapu',
    'Current screed drying target temperature': 'Aktualna zadana temperatura wygrzewania jastrychu',
    'Duration in target temperature range': 'Czas w zakresie temperatury zadanej',
    'Total screed drying duration': 'Całkowity czas wygrzewania jastrychu',
    'Highest flow temperature reached': 'Najwyższa osiągnięta temperatura zasilania',
    'Frost protection stage 1 start outdoor temperature':
        'Temperatura zewnętrzna rozpoczęcia ochrony przeciwzamrożeniowej 1',
    'Frost protection stage 2 start outdoor temperature':
        'Temperatura zewnętrzna rozpoczęcia ochrony przeciwzamrożeniowej 2',
    'Frost protection stage 2 stop outdoor temperature':
        'Temperatura zewnętrzna zakończenia ochrony przeciwzamrożeniowej 2',
    'Frost protection stage 2 start water temperature': 'Temperatura wody rozpoczęcia ochrony przeciwzamrożeniowej 2',
    'Frost protection stage 2 stop water temperature': 'Temperatura wody zakończenia ochrony przeciwzamrożeniowej 2',
    'Operating mode switch for defrost': 'Przełączanie trybu pracy przy odszranianiu',
    'Three-way valve switching time': 'Czas przełączania zaworu trójdrogowego',
    'Three-way valve supply time': 'Czas zasilania zaworu trójdrogowego',
    'Maximum fan output': 'Maksymalna moc wentylatora',
    'Operating mode signal output': 'Wyjście sygnału trybu pracy',
    'Operating mode signal output switching logic': 'Logika przełączania wyjścia sygnału trybu pracy',
    'Parallel shift of heating curve 1': 'Równoległe przesunięcie krzywej grzewczej 1',
    'Parallel shift of heating curve 2': 'Równoległe przesunięcie krzywej grzewczej 2',
    'Enable domestic hot water ECO function': 'Włącz funkcję ECO dla CWU',
    'Outdoor temperature limit for domestic hot water ECO': 'Granica temperatury zewnętrznej dla ECO CWU',
    'Enable heating ECO function': 'Włącz funkcję ECO ogrzewania',
    'Outdoor temperature limit for heating ECO': 'Granica temperatury zewnętrznej dla ECO ogrzewania',
    'Detect displaced domestic hot water sensor': 'Wykrywaj przemieszczenie czujnika CWU',
    'Signal to switch off outdoor unit power': 'Sygnał wyłączenia zasilania jednostki zewnętrznej',
    'Outdoor temperature to end outdoor unit shutdown':
        'Temperatura zewnętrzna zakończenia wyłączenia jednostki zewnętrznej',
    'Pump speed during heating': 'Prędkość pompy podczas ogrzewania',
    'Pump speed during cooling': 'Prędkość pompy podczas chłodzenia',
    'Pump speed during domestic hot water operation': 'Prędkość pompy podczas przygotowania CWU',
    'Block auxiliary heater AH': 'Zablokuj grzałkę pomocniczą AH',
    'Block auxiliary heater AH based on outdoor temperature': 'Blokuj grzałkę AH zależnie od temperatury zewnętrznej',
    'Outdoor temperature limit for blocking auxiliary heater AH':
        'Granica temperatury zewnętrznej blokowania grzałki AH',
    'Outdoor unit board EEPROM version': 'Wersja EEPROM płyty jednostki zewnętrznej',
    Information: 'Informacje',
    'W600 connected': 'W600 połączone',
    'Bridge listener active': 'Nasłuchiwanie mostu aktywne',
    'Last error': 'Ostatni błąd',
    'TCP bridge': 'Most TCP',
    'Bridge status': 'Stan mostu',
    'Upstream connected': 'Serwer producenta połączony',
    'Last frame CRC valid': 'Poprawne CRC ostatniej ramki',
    'Active W600 clients': 'Aktywne połączenia W600',
    'Listen port': 'Port nasłuchiwania',
    'Connected upstream port': 'Port połączonego serwera producenta',
    'Last frame length': 'Długość ostatniej ramki',
    'Discarded stream bytes': 'Odrzucone bajty strumienia',
    'Bytes forwarded from W600 to upstream': 'Bajty przekazane z W600 do serwera',
    'Bytes forwarded from upstream to W600': 'Bajty przekazane z serwera do W600',
    'Upstream reconnect attempts': 'Próby ponownego połączenia z serwerem',
    'Listen host': 'Adres nasłuchiwania',
    'Connected upstream host': 'Adres połączonego serwera producenta',
    'Last W600 remote endpoint': 'Ostatni zdalny adres W600',
    'Last upstream error': 'Ostatni błąd serwera producenta',
    'Last W600-to-upstream forwarding': 'Ostatnie przekazanie z W600 do serwera',
    'Last upstream-to-W600 forwarding': 'Ostatnie przekazanie z serwera do W600',
    'Last frame direction': 'Kierunek ostatniej ramki',
    'Last frame command': 'Polecenie ostatniej ramki',
    Metadata: 'Metadane',
    'Last valid realtime frame': 'Ostatnia poprawna ramka danych bieżących',
    'Last valid settings frame': 'Ostatnia poprawna ramka ustawień',
    'W600 module MAC / MN number': 'Adres MAC modułu W600 / numer MN',
    'Device identifier / W600 module MAC': 'Identyfikator urządzenia / MAC modułu W600',
    'Frame identifier': 'Identyfikator ramki',
    'Frame target': 'Adres docelowy ramki',
    'Mapping schema version': 'Wersja schematu mapowania',
    'Operating status': 'Stan pracy',
    'Active function code': 'Kod aktywnej funkcji',
    'Effective flow temperature setpoint': 'Efektywna zadana temperatura zasilania',
    'Heating curve active': 'Krzywa grzewcza aktywna',
    'Compressor demand (inferred)': 'Zapotrzebowanie na sprężarkę (wywnioskowane)',
    'Compressor running': 'Sprężarka pracuje',
    'Flow switch active': 'Czujnik przepływu aktywny',
    'Defrost active': 'Odszranianie aktywne',
    'Pump P0 running': 'Pompa P0 pracuje',
    'Pump P1 running': 'Pompa P1 pracuje',
    'Pump P2 running': 'Pompa P2 pracuje',
    'Outdoor unit fan 1 running': 'Wentylator 1 jednostki zewnętrznej pracuje',
    'Outdoor unit fan 2 running': 'Wentylator 2 jednostki zewnętrznej pracuje',
    'Realtime telemetry': 'Dane bieżące',
    'Realtime JSON': 'Dane bieżące JSON',
    'CMD01 raw values JSON': 'Surowe wartości CMD01 JSON',
    'Confirmed settings': 'Potwierdzone ustawienia',
    'Heating curve': 'Krzywa grzewcza',
    'CMD02 raw values JSON': 'Surowe wartości CMD02 JSON',
    'Confirmed parameter count': 'Liczba potwierdzonych parametrów',
    'Directly writable parameter count': 'Liczba parametrów z bezpośrednim zapisem',
    Frames: 'Ramki',
    'Last frame payload': 'Dane ostatniej ramki',
    'Last frame update': 'Ostatnia aktualizacja ramki',
    Writes: 'Zapis',
    'Last write attempt': 'Ostatnia próba zapisu',
    'Last write update': 'Ostatnia aktualizacja zapisu',
    'Captured valid cloud-to-unit CMD05 frames': 'Odebrane poprawne ramki CMD05 z chmury do urządzenia',
    'Distinct valid cloud-to-unit CMD05 frames': 'Różne poprawne ramki CMD05 z chmury do urządzenia',
    Diagnostics: 'Diagnostyka',
    'Received frames': 'Odebrane ramki',
    'Realtime updates': 'Aktualizacje danych bieżących',
    'Settings updates': 'Aktualizacje ustawień',
    'Frame updates': 'Aktualizacje ramek',
    'Invalid values': 'Nieprawidłowe wartości',
    'Last received frame': 'Ostatnia odebrana ramka',
    'Last source': 'Ostatnie źródło',
    'Last payload': 'Ostatnie dane',
    'CMD01 prefix bytes (raw)': 'Bajty prefiksu CMD01 (surowe)',
    'Heat-pump control': 'Sterowanie pompą ciepła',
    'MyHeatPump cloud connected': 'Połączenie z chmurą MyHeatPump',
    'Cloud control available': 'Sterowanie przez chmurę dostępne',
    'Cloud writes enabled': 'Zapis przez chmurę włączony',
    'A confirmed write path is ready': 'Potwierdzona ścieżka zapisu gotowa',
    'Direct W600 writes enabled': 'Bezpośredni zapis do W600 włączony',
    'Direct W600 write path ready': 'Bezpośrednia ścieżka zapisu do W600 gotowa',
    'Last control transport': 'Ostatni kanał sterowania',
    'Confirmed direct W600 controls': 'Potwierdzone bezpośrednie polecenia W600',
    'MyHeatPump device online': 'Urządzenie MyHeatPump online',
    'Cloud control status': 'Stan sterowania przez chmurę',
    'MyHeatPump device ID': 'Identyfikator urządzenia MyHeatPump',
    'MyHeatPump device name': 'Nazwa urządzenia MyHeatPump',
    'MyHeatPump device serial number': 'Numer seryjny urządzenia MyHeatPump',
    'Cloud device selector used': 'Użyty selektor urządzenia w chmurze',
    'Available cloud modes': 'Dostępne tryby chmury',
    'Last cloud synchronization': 'Ostatnia synchronizacja z chmurą',
    'Last control command': 'Ostatnie polecenie sterowania',
    'Last control command time': 'Czas ostatniego polecenia sterowania',
    'Last control command result': 'Wynik ostatniego polecenia sterowania',
    'Last control error': 'Ostatni błąd sterowania',
    'Refresh cloud control data': 'Odśwież dane sterowania z chmury',
    'Heat pump on/off': 'Włącz/wyłącz pompę ciepła',
    'Flow temperature setpoint without heating curve': 'Zadana temperatura zasilania bez krzywej grzewczej',
    Commands: 'Polecenia',
    'Acknowledge realtime frame': 'Potwierdź ramkę danych bieżących',
    'Acknowledge settings frame': 'Potwierdź ramkę ustawień',
    'Request realtime data': 'Zażądaj danych bieżących',
    'Request settings data': 'Zażądaj danych ustawień',
    'Send reserved command 08': 'Wyślij zarezerwowane polecenie 08',
    'Send reserved command 09': 'Wyślij zarezerwowane polecenie 09',
    'Raw hex frame': 'Surowa ramka szesnastkowa',
    'Send raw hex frame': 'Wyślij surową ramkę szesnastkową',
    'Republish cached data to MyHeatPump': 'Wyślij ponownie zapisane dane do MyHeatPump',
    'Last sent command': 'Ostatnie wysłane polecenie',
    'Last sent time': 'Czas ostatniego wysłania',
    'Last command result': 'Wynik ostatniego polecenia',
    'Last command error': 'Ostatni błąd polecenia',
    'Flow water temperature Tuo': 'Temperatura zasilania Tuo',
    'Return water temperature Tui': 'Temperatura powrotu Tui',
    'Heat exchanger temperature Tup': 'Temperatura wymiennika ciepła Tup',
    'Domestic hot water temperature Tw': 'Temperatura ciepłej wody użytkowej Tw',
    'Heating/cooling water temperature Tc': 'Temperatura wody grzewczej/chłodzącej Tc',
    'Mixing circuit 1 temperature Tv1': 'Temperatura obiegu mieszającego 1 Tv1',
    'Mixing circuit 2 temperature Tv2': 'Temperatura obiegu mieszającego 2 Tv2',
    'Room temperature Tr': 'Temperatura pokojowa Tr',
    'Circulation pump P0 PWM signal': 'Sygnał PWM pompy obiegowej P0',
    'Mixing valve 1 signal': 'Sygnał zaworu mieszającego 1',
    'Mixing valve 2 signal': 'Sygnał zaworu mieszającego 2',
    'Flow switch': 'Czujnik przepływu',
    'Compressor frequency': 'Częstotliwość sprężarki',
    'Electronic expansion valve': 'Elektroniczny zawór rozprężny',
    'High pressure Pd': 'Wysokie ciśnienie Pd',
    'Low pressure Ps': 'Niskie ciśnienie Ps',
    'Outdoor temperature Ta': 'Temperatura zewnętrzna Ta',
    'Discharge gas temperature Td': 'Temperatura gazu tłocznego Td',
    'Suction gas temperature Ts': 'Temperatura gazu ssawnego Ts',
    'Outdoor heat exchanger temperature Tp': 'Temperatura wymiennika zewnętrznego Tp',
    'Outdoor unit fan 1': 'Wentylator 1 jednostki zewnętrznej',
    'Outdoor unit fan 2': 'Wentylator 2 jednostki zewnętrznej',
    'Electrical current': 'Prąd elektryczny',
    'Supply voltage': 'Napięcie zasilania',
    Defrost: 'Odszranianie',
    'Internal circulation pump P0': 'Wewnętrzna pompa obiegowa P0',
    'Pump P1 state': 'Stan pompy P1',
    'Pump P2 state': 'Stan pompy P2',
    'Currently effective flow temperature setpoint': 'Aktualna efektywna zadana temperatura zasilania',
    'Calculated compressor stage': 'Obliczony stopień sprężarki',
    'Suction superheat': 'Przegrzanie na ssaniu',
    'Discharge superheat': 'Przegrzanie na tłoczeniu',
    'AH runtime': 'Czas pracy AH',
    'HBH runtime': 'Czas pracy HBH',
    'HWTBH runtime': 'Czas pracy HWTBH',
    'System enabled': 'System włączony',
    'Selected operating mode': 'Wybrany tryb pracy',
    'Domestic hot water enabled': 'Ciepła woda użytkowa włączona',
    'Heating enabled': 'Ogrzewanie włączone',
    'Cooling enabled': 'Chłodzenie włączone',
    'Constant cooling flow setpoint': 'Stała zadana temperatura zasilania dla chłodzenia',
    'Constant heating flow setpoint': 'Stała zadana temperatura zasilania dla ogrzewania',
    Standby: 'Czuwanie',
    Heating: 'Ogrzewanie',
    Cooling: 'Chłodzenie',
    'Hot water': 'Ciepła woda użytkowa',
    'Heating + hot water': 'Ogrzewanie + ciepła woda użytkowa',
    'Cooling + hot water': 'Chłodzenie + ciepła woda użytkowa',
    'Domestic hot water': 'Ciepła woda użytkowa',
    Automatic: 'Automatyczny',
    Inactive: 'Nieaktywny',
    Disabled: 'Wyłączone',
    'Outdoor temperature': 'Temperatura zewnętrzna',
    'External signal': 'Sygnał zewnętrzny',
    'External signal and outdoor temperature': 'Sygnał zewnętrzny i temperatura zewnętrzna',
    'Below AH': 'Niższy niż AH',
    'Above AH': 'Wyższy niż AH',
    'Normally closed (NC)': 'Normalnie zamknięty (NC)',
    'Normally open (NO)': 'Normalnie otwarty (NO)',
    Continuous: 'Ciągły',
    'Variable-speed DC pump (PWM)': 'Pompa DC o regulowanej prędkości (PWM)',
    'AC pump': 'Pompa AC',
    'High speed': 'Wysoka prędkość',
    'Medium speed': 'Średnia prędkość',
    'Low speed': 'Niska prędkość',
    'Interval mode': 'Tryb interwałowy',
    'Off with compressor': 'Wyłączenie razem ze sprężarką',
    'No output': 'Brak wyjścia',
    'Adapter-generated validation messages are bilingual. Operating-system and vendor/cloud error details are preserved verbatim and may use their original language.':
        'Komunikaty walidacyjne adaptera są po angielsku i niemiecku. Szczegóły błędów systemu, producenta lub chmury pozostają w oryginalnym języku.',
    'Adapter-generated connection messages are bilingual; operating-system error details remain verbatim.':
        'Komunikaty połączenia adaptera są po angielsku i niemiecku; szczegóły błędów systemu pozostają niezmienione.',
    'Updated only by a CRC-valid CMD01 frame; invalid frames do not refresh telemetry freshness.':
        'Aktualizowane tylko przez ramkę CMD01 z poprawnym CRC; błędne ramki nie odświeżają aktualności danych.',
    'Updated only by a CRC-valid CMD02 frame; invalid frames do not refresh settings freshness.':
        'Aktualizowane tylko przez ramkę CMD02 z poprawnym CRC; błędne ramki nie odświeżają aktualności ustawień.',
    'Live-confirmed CMD01 function code: 0 inactive, 2 heating, 3 cooling.':
        'Kod funkcji CMD01 potwierdzony podczas pracy: 0 nieaktywny, 2 ogrzewanie, 3 chłodzenie.',
    'Current flow-water target from CMD01 par36. With the heating curve active, this is the calculated target.':
        'Aktualna zadana temperatura zasilania z CMD01 par36. Przy aktywnej krzywej grzewczej jest to wartość obliczona.',
    'Confirmed heating-curve enable state from CMD02 setting_023.':
        'Potwierdzony stan włączenia krzywej grzewczej z CMD02 setting_023.',
    'Compatibility proxy derived from a nonzero active-function code. No independent demand bit is validated; this does not prove a compressor request or operation.':
        'Wskaźnik zgodności wywnioskowany z niezerowego kodu aktywnej funkcji. Niezależny bit zapotrzebowania nie został potwierdzony; wartość nie dowodzi żądania ani pracy sprężarki.',
    'Derived from the verified compressor frequency; true when realtime.Frequency is greater than 0 Hz.':
        'Wywnioskowane z potwierdzonej częstotliwości sprężarki; true, gdy realtime.Frequency przekracza 0 Hz.',
    'Official flow-switch state from CMD01 par15.': 'Oficjalny stan czujnika przepływu z CMD01 par15.',
    'Official defrost state from CMD01 par32.': 'Oficjalny stan odszraniania z CMD01 par32.',
    'Official pump P0 state from CMD01 par33.': 'Oficjalny stan pompy P0 z CMD01 par33.',
    'Official pump P1 state from CMD01 par34.': 'Oficjalny stan pompy P1 z CMD01 par34.',
    'Official pump P2 state from CMD01 par35.': 'Oficjalny stan pompy P2 z CMD01 par35.',
    'Derived from the official fan 1 speed in CMD01 par28.':
        'Wywnioskowane z oficjalnej prędkości wentylatora 1 w CMD01 par28.',
    'Derived from the official fan 2 speed in CMD01 par29.':
        'Wywnioskowane z oficjalnej prędkości wentylatora 2 w CMD01 par29.',
    'Raw frame content is replaced with [suppressed] when retainRawFrames is disabled.':
        'Surowa zawartość ramki jest zastępowana przez [suppressed], gdy retainRawFrames jest wyłączone.',
    'Raw and payload fields are suppressed when retainRawFrames is disabled; command status and metadata remain.':
        'Surowe dane są ukrywane, gdy retainRawFrames jest wyłączone; stan polecenia i metadane pozostają.',
    'Raw CMD05 history is cleared when retainRawFrames is disabled; the numeric capture count remains.':
        'Surowa historia CMD05 jest usuwana, gdy retainRawFrames jest wyłączone; licznik odebranych ramek pozostaje.',
    'Reception time includes frames with invalid CRC; use meta.last_seen and meta.last_setparams for valid telemetry freshness.':
        'Czas odbioru obejmuje też ramki z błędnym CRC; aktualność poprawnych danych sprawdzaj przez meta.last_seen i meta.last_setparams.',
    'Raw payload is replaced with [suppressed] when retainRawFrames is disabled.':
        'Surowe dane są zastępowane przez [suppressed], gdy retainRawFrames jest wyłączone.',
    'The ten unassigned CMD01 prefix bytes are shown only when raw-frame retention is enabled.':
        'Dziesięć niezidentyfikowanych bajtów prefiksu CMD01 jest pokazywanych tylko przy włączonym zachowywaniu surowych ramek.',
    'Cloud readiness requires an explicitly enabled write path and a confirmed online state; direct readiness requires exactly one active W600 connection.':
        'Gotowość chmury wymaga jawnego włączenia zapisu i potwierdzonego stanu online; gotowość zapisu bezpośredniego wymaga dokładnie jednego aktywnego połączenia W600.',
    'Enables direct W600 control. Local direct commands are rejected unless exactly one W600 connection is active.':
        'Włącza bezpośrednie sterowanie W600. Polecenia lokalne są odrzucane, jeśli nie ma dokładnie jednego aktywnego połączenia W600.',
    'True only when direct writes are enabled, exactly one W600 connection is active, and a verified frame context is available.':
        'True tylko przy włączonym zapisie bezpośrednim, dokładnie jednym aktywnym połączeniu W600 i potwierdzonym kontekście ramki.',
    'Online state reported by the MyHeatPump cloud API.': 'Stan online zgłoszony przez API chmury MyHeatPump.',
    'Status values are stable machine-readable strings and are not translated.':
        'Wartości stanu są stałymi ciągami do odczytu maszynowego i nie są tłumaczone.',
    'For direct W600 writes, success means the same connection returned a matching CRC-valid CMD02 value; this confirms the reported setting, not physical compressor action. For cloud writes, success means the API returned a successful command result; the later snapshot refresh is best-effort and also does not prove physical action.':
        'Przy zapisie bezpośrednim sukces oznacza zgodną wartość CMD02 z poprawnym CRC z tego samego połączenia. Potwierdza ustawienie, nie fizyczną pracę sprężarki. Przy zapisie przez chmurę sukces oznacza pozytywny wynik API; późniejsze odświeżenie jest próbą bez gwarancji i też nie dowodzi fizycznego działania.',
    'Adapter-generated validation messages are bilingual. Text returned by the cloud API or operating system is preserved verbatim and may use its original language.':
        'Komunikaty walidacyjne adaptera są po angielsku i niemiecku. Tekst API chmury i systemu pozostaje w oryginalnym języku.',
    'Direct W600 writes require a single active W600 connection and matching fresh CMD02 readback. Cloud API success does not prove physical relay or compressor action.':
        'Bezpośredni zapis W600 wymaga jednego aktywnego połączenia i zgodnego świeżego odczytu zwrotnego CMD02. Sukces API chmury nie dowodzi fizycznego działania przekaźnika ani sprężarki.',
    'Direct modes 0 through 4 require exactly one active W600 connection and matching fresh CMD02 readback on that connection. Combined modes 5 and 6 remain cloud-only.':
        'Bezpośrednie tryby 0–4 wymagają dokładnie jednego aktywnego połączenia W600 i zgodnego świeżego odczytu CMD02 z tego połączenia. Tryby łączone 5 i 6 pozostają dostępne tylko przez chmurę.',
    'Fixed flow target without the heating curve from MyHeatPump par38 / W600 CMD05 parameter 37. With the curve active, use status.effectiveFlowSetpoint. Direct writes require exactly one active W600 connection and matching fresh CMD02 readback.':
        'Stała zadana temperatura zasilania bez krzywej grzewczej z MyHeatPump par38 / W600 CMD05 parametr 37. Przy aktywnej krzywej używaj status.effectiveFlowSetpoint. Zapis bezpośredni wymaga dokładnie jednego połączenia W600 i zgodnego świeżego odczytu CMD02.',
    'Direct W600 CMD05 cooling target, confirmed by a matching fresh CMD02 readback. Direct writes require exactly one active W600 connection.':
        'Bezpośrednia zadana temperatura chłodzenia W600 CMD05, potwierdzana zgodnym świeżym odczytem CMD02. Zapis wymaga dokładnie jednego aktywnego połączenia W600.',
    'Official MyHeatPump par55 / direct W600 CMD05 parameter 54 target. Direct writes require exactly one active W600 connection and matching fresh CMD02 readback.':
        'Oficjalna wartość zadana MyHeatPump par55 / bezpośredni W600 CMD05 parametr 54. Zapis wymaga dokładnie jednego aktywnego połączenia W600 i zgodnego świeżego odczytu CMD02.',
    'Adapter-generated validation messages are bilingual; protocol and operating-system error details may remain verbatim.':
        'Komunikaty walidacyjne adaptera są po angielsku i niemiecku; szczegóły błędów protokołu i systemu mogą pozostać niezmienione.',
    'Live-confirmed function code: 0 inactive, 2 heating, 3 cooling.':
        'Kod funkcji potwierdzony podczas pracy: 0 nieaktywny, 2 ogrzewanie, 3 chłodzenie.',
    'Water outlet temperature of the heat pump.': 'Temperatura wody na wylocie pompy ciepła.',
    'Water inlet temperature of the heat pump.': 'Temperatura wody na wlocie pompy ciepła.',
    'Temperature at the plate heat exchanger or liquid line.':
        'Temperatura na płytowym wymienniku ciepła lub przewodzie cieczowym.',
    'DHW tank temperature; not created when the sensor is absent.':
        'Temperatura zasobnika CWU; punkt nie jest tworzony przy braku czujnika.',
    'Control temperature of the heating/cooling circuit or buffer.':
        'Temperatura regulacji obiegu ogrzewania/chłodzenia lub bufora.',
    'Temperature sensor for mixing circuit 1.': 'Czujnik temperatury obiegu mieszającego 1.',
    'Temperature sensor for mixing circuit 2; not created when the sensor is absent.':
        'Czujnik temperatury obiegu mieszającego 2; punkt nie jest tworzony przy braku czujnika.',
    'Room temperature sensor.': 'Czujnik temperatury pokojowej.',
    'Official PWM signal of pump P0.': 'Oficjalny sygnał PWM pompy P0.',
    'Official output signal for mixing valve 1.': 'Oficjalny sygnał wyjściowy zaworu mieszającego 1.',
    'Official output signal for mixing valve 2.': 'Oficjalny sygnał wyjściowy zaworu mieszającego 2.',
    'Operating state of the flow switch (0/1).': 'Stan czujnika przepływu (0/1).',
    'Actual compressor frequency.': 'Rzeczywista częstotliwość sprężarki.',
    'Opening position of the electronic expansion valve.': 'Pozycja otwarcia elektronicznego zaworu rozprężnego.',
    'High/condensing pressure of the refrigerant circuit.':
        'Wysokie ciśnienie/ciśnienie skraplania obiegu chłodniczego.',
    'Suction/evaporation pressure of the refrigerant circuit.': 'Ciśnienie ssania/parowania obiegu chłodniczego.',
    'Outdoor temperature sensor.': 'Czujnik temperatury zewnętrznej.',
    'Compressor discharge-gas temperature.': 'Temperatura gazu tłocznego sprężarki.',
    'Compressor suction-gas temperature.': 'Temperatura gazu ssawnego sprężarki.',
    'Temperature of the outdoor heat exchanger.': 'Temperatura zewnętrznego wymiennika ciepła.',
    'Outdoor unit fan 1 speed.': 'Prędkość wentylatora 1 jednostki zewnętrznej.',
    'Outdoor unit fan 2 speed.': 'Prędkość wentylatora 2 jednostki zewnętrznej.',
    'Measured electrical current.': 'Zmierzony prąd elektryczny.',
    'Measured mains/inverter supply voltage.': 'Zmierzone napięcie zasilania sieci/falownika.',
    'Official defrost state (0/1).': 'Oficjalny stan odszraniania (0/1).',
    'Operating state of internal circulation pump P0 (0/1).': 'Stan wewnętrznej pompy obiegowej P0 (0/1).',
    'Official operating state of pump P1 (0/1).': 'Oficjalny stan pompy P1 (0/1).',
    'Official operating state of pump P2 (0/1).': 'Oficjalny stan pompy P2 (0/1).',
    'Flow-water target currently used by the controller; with the heating curve active this is the calculated flow target.':
        'Zadana temperatura zasilania aktualnie używana przez regulator; przy aktywnej krzywej grzewczej jest to wartość obliczona.',
    'Numeric controller software version.': 'Numeryczna wersja oprogramowania regulatora.',
    'Official Calculated Comp. Speed value; distinct from compressor frequency in Hz.':
        'Oficjalna wartość Calculated Comp. Speed; nie jest to częstotliwość sprężarki w Hz.',
    'Official Suction Superheat.': 'Oficjalna wartość przegrzania na ssaniu.',
    'Official Discharge Superheat.': 'Oficjalna wartość przegrzania na tłoczeniu.',
    'Official runtime of the electric auxiliary heater AH.': 'Oficjalny czas pracy grzałki elektrycznej AH.',
    'Official runtime of the heating backup heat source HBH.':
        'Oficjalny czas pracy dodatkowego źródła ogrzewania HBH.',
    'Official runtime of the domestic hot water backup heat source HWTBH.':
        'Oficjalny czas pracy dodatkowego źródła CWU HWTBH.',
    'CMD02 setting_000; live-correlated with on/off.':
        'CMD02 setting_000; powiązanie z włączaniem/wyłączaniem potwierdzone podczas pracy.',
    'CMD02 setting_003; documented and live-correlated operating mode.':
        'CMD02 setting_003; udokumentowany tryb pracy potwierdzony podczas pracy urządzenia.',
    'CMD02 setting_005; documented function enable.': 'CMD02 setting_005; udokumentowane włączenie funkcji.',
    'CMD02 setting_006; live-correlated when enabled.': 'CMD02 setting_006; włączenie potwierdzone podczas pracy.',
    'CMD02 setting_007; live-correlated when enabled.': 'CMD02 setting_007; włączenie potwierdzone podczas pracy.',
    'CMD02 setting_022; 16 to 21 degrees confirmed by real MyHeatPump CMD05 changes; 22 to 24 degrees require exact fresh CMD02 readback.':
        'CMD02 setting_022; zakres 16–21 stopni potwierdzony rzeczywistymi zmianami MyHeatPump CMD05; 22–24 stopnie wymagają dokładnego świeżego odczytu zwrotnego CMD02.',
    'CMD02 setting_037; observed live equal to the active heating setpoint.':
        'CMD02 setting_037; podczas pracy zaobserwowano zgodność z aktywną temperaturą zadaną ogrzewania.',
};

export function polishText(english: string): string {
    if (TEXT[english]) {
        return TEXT[english];
    }
    let match = /^Heating curve (outdoor temperature|flow temperature|flow target) point ([1-5])$/.exec(english);
    if (match) {
        return `Punkt ${match[2]} krzywej grzewczej: ${match[1] === 'outdoor temperature' ? 'temperatura zewnętrzna' : 'temperatura zasilania'}`;
    }
    match = /^Outdoor\/water temperature characteristic ([A-E])$/.exec(english);
    if (match) {
        return `Charakterystyka temperatury zewnętrznej/wody ${match[1]}`;
    }
    match = /^Raw value (par\d+)$/.exec(english);
    if (match) {
        return `Wartość surowa ${match[1]}`;
    }
    return polishDescription(english) ?? english;
}

export function polishStates<T extends string | number>(states: Record<T, string>): Record<T, string> {
    return Object.fromEntries(
        Object.entries(states).map(([key, value]) => {
            const label = value as string;
            const english = label.includes(' / ') ? label.slice(label.indexOf(' / ') + 3) : label;
            const polish = polishText(english);
            return [key, polish === english && !TEXT[english] ? label : `${label} / ${polish}`];
        }),
    ) as Record<T, string>;
}

function polishDescription(english: string): string | undefined {
    let generated = /^Adapter (state|channel) for (.+)\.$/.exec(english);
    if (generated) {
        return `${generated[1] === 'state' ? 'Stan' : 'Kanał'} adaptera: ${polishText(generated[2])}.`;
    }
    generated = /^(First|Second|Third|Fourth|Fifth) heating-curve outdoor temperature point\.$/.exec(english);
    if (generated) {
        const point = ['First', 'Second', 'Third', 'Fourth', 'Fifth'].indexOf(generated[1]) + 1;
        return `Punkt ${point} temperatury zewnętrznej krzywej grzewczej.`;
    }
    generated = /^Flow target at the (first|second|third|fourth|fifth) heating-curve point\.$/.exec(english);
    if (generated) {
        const point = ['first', 'second', 'third', 'fourth', 'fifth'].indexOf(generated[1]) + 1;
        return `Zadana temperatura zasilania w punkcie ${point} krzywej grzewczej.`;
    }
    const match =
        /^(Read-only confirmed|Confirmed) CMD02 value for official MyHeatPump field (par\d+) \((setting_\d+)\)(.*)$/.exec(
            english,
        );
    if (match) {
        return `${match[1].startsWith('Read-only') ? 'Potwierdzona wartość CMD02 tylko do odczytu' : 'Potwierdzona wartość CMD02'} dla oficjalnego pola MyHeatPump ${match[2]} (${match[3]})${match[1].startsWith('Read-only') ? '.' : '; bezpośredni zapis CMD05 wymaga zgodnego, świeżego odczytu zwrotnego CMD02 z tego samego połączenia.'}`;
    }
    const raw = /^CMD01 Float (\d+) \((par\d+)\); its technical meaning has not been confirmed\.$/.exec(english);
    if (raw) {
        return `CMD01 Float ${raw[1]} (${raw[2]}); znaczenie techniczne nie zostało potwierdzone.`;
    }
    return undefined;
}
