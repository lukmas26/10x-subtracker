---
project: "SubTracker"
context_type: greenfield
created: 2026-09-19
updated: 2026-09-19
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 1
  hard_deadline: 2026-11-04
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "brak widoczności / paraliż decyzyjny / tarcie we flow (wszystkie trzy)"
    - topic: "primary persona scope"
      decision: "pojedynczy nazwany użytkownik (sam autor); znajomi to przyszli użytkownicy, nie MVP"
    - topic: "auth strategy"
      decision: "email + hasło"
    - topic: "role model"
      decision: "user / admin; admin kuratoruje wspólny katalog subskrypcji i przypisuje im kategorie, bez wglądu w cudze dane finansowe (doprecyzowane 2026-09-19)"
    - topic: "insight"
      decision: "wyciąg bankowy pokazuje transakcje przeszłe, produkt pokazuje przyszłe zobowiązania — różnica perspektywy czasowej (rozstrzygnięte 2026-09-19)"
    - topic: "FR-007 acceptance criteria"
      decision: "US-02: próg ≥2 subskrypcji w kategorii, wskazanie konkretnej subskrypcji, kwota oszczędności, możliwość odrzucenia rekomendacji"
    - topic: "mvp first flow"
      decision: "login → dodanie subskrypcji → widok na liście; ~1 tydzień, brak scope-cost trigger"
    - topic: "FR priorities"
      decision: "edycja/usuwanie/podsumowanie/rekomendacje = must-have; grupowanie przez admina = nice-to-have"
    - topic: "business logic rule"
      decision: "grupowanie po kategorii (ręcznie wybranej), rekomendacja gdy >1 subskrypcja w kategorii: wyłącz / konsoliduj do wyższego planu / zamień na tańszą alternatywę"
    - topic: "AI-based categorization & auto-fetch plan info"
      decision: "scope-cost surfaced — wykracza poza 1-tydz. MVP; zeskopowane jako nice-to-have (FR-008, FR-009) na później"
    - topic: "NFRs"
      decision: "prywatność danych finansowych, brak utraty danych, szybka odpowiedź UI, wsparcie głównych przeglądarek/urządzeń"
    - topic: "product framing"
      decision: "web-app; skala: tylko autor + ew. kilka osób; deadline 2026-11-04; praca po godzinach"
    - topic: "non-goals"
      decision: "brak integracji bankowej, brak współdzielenia kont, brak gwarancji offline"
  frs_drafted: 9
  quality_check_status: accepted
---

# Shape Notes

## Seed idea

System do trackowania aktywnych subskrypcji (miesięcznych i rocznych), podsumowanie wydatków, propozycje co wyłączyć lub zamienić na tańsze. Dane dodawane ręcznie przez użytkownika (bez integracji bankowej). Wymaga prostego mechanizmu logowania.

## Vision & Problem Statement

Osoby płacące kartą za wiele cyklicznych subskrypcji (miesięcznych i rocznych) tracą nad nimi widoczność — subskrypcje odnawiają się automatycznie, a ponieważ pojedyncze kwoty są małe, duplikaty i nieużywane usługi przechodzą niezauważone. Ból objawia się na trzech poziomach: brak widoczności (dane o subskrypcjach są rozproszone — wyciąg z karty, pamięć, maile), paraliż decyzyjny (nawet widząc listę, nie wiadomo co bezpiecznie anulować) i tarcie w działaniu (każda usługa ma inny proces anulowania). Koszt dziś: powolny, niezauważalny wyciek pieniędzy bez regularnego przeglądu.

Wyciąg z karty pokazuje transakcje, które już się wydarzyły — pojedynczo, chronologicznie, bez informacji o tym, co powtórzy się w przyszłym miesiącu. SubTracker pokazuje zobowiązania: to, co będzie płacone dalej, zsumowane i pogrupowane. To różnica perspektywy czasowej, a nie ładniejsza prezentacja tych samych danych.

**Nota ze skalowania (Faza 6):** przy 100x większej skali (setki/tysiące userów) ręczny wybór kategorii przestałby się skalować UX-owo — potrzebny byłby wbudowany katalog usług. To dodatkowe uzasadnienie dla FR-008/FR-009 jako naturalnego kierunku rozwoju po MVP.

## User & Persona

**Primary persona**: pojedynczy użytkownik zarządzający własnymi finansami — buduje produkt najpierw dla siebie (znajomi to potencjalni kolejni użytkownicy w przyszłości, nie MVP). Płaci kartą za kilka-kilkanaście cyfrowych usług subskrypcyjnych (streaming, narzędzia, itp.) i samodzielnie decyduje o domowym budżecie. Sięga po produkt przy okazji przeglądu wydatków (np. po otrzymaniu wyciągu z karty lub raz w miesiącu), chcąc szybko zobaczyć, czy płaci za coś niepotrzebnie lub podwójnie.

## Access Control

Logowanie: email + hasło. Model ról: dwie role — `user` i `admin`.

| Rola  | Uprawnienia |
| --- | --- |
| user  | tworzy/odczytuje/edytuje/usuwa własne subskrypcje; widzi podsumowanie wydatków; widzi propozycje co wyłączyć/zamienić |
| admin | wszystko co `user`, plus zarządza wspólnym katalogiem subskrypcji — dodaje do niego pozycje i przypisuje im kategorie |

Admin nie ma wglądu w dane finansowe innych użytkowników — kuratoruje wyłącznie wspólny katalog usług i kategorii. Użytkownik przy dodawaniu subskrypcji wybiera kategorię z listy albo tworzy własną. Docelowy cel katalogu: ta sama usługa nie jest zakładana wielokrotnie, osobno przez każdego użytkownika.

## Success Criteria

### Primary
- Użytkownik loguje się, dodaje pierwszą subskrypcję (nazwa, kwota, cykl płatności) i widzi ją na liście.

### Secondary
- Pierwsza wersja rekomendacji — system sugeruje co wyłączyć lub zamienić na tańsze.

### Guardrails
- Dane finansowe użytkownika widoczne tylko dla niego (brak wycieku między kontami).
- Brak utraty danych o subskrypcjach — raz dodana subskrypcja nie znika bez akcji użytkownika.

## Functional Requirements

### Uwierzytelnianie
- FR-001: User can zalogować się przy użyciu email i hasła. Priority: must-have
  > Socrates: Brak kontrargumentu — FR stoi bez zmian.

### Subskrypcje
- FR-002: User can dodać subskrypcję (nazwa, kwota, cykl płatności: miesięczny/roczny, kategoria wybrana z listy lub utworzona własna). Priority: must-have
  > Socrates: Kontrargument rozważony: "bez tych pól rekomendacje (FR-007) nie mają danych wejściowych". Rozwiązanie: kwota, cykl i kategoria pozostają wymagane — to minimalny zestaw danych, na którym opiera się cała reszta produktu. Pole kategorii dopisane w Fazie 5 — jest wejściem do reguły grupowania w Business Logic.
- FR-003: User can edytować istniejącą subskrypcję. Priority: must-have
  > Socrates: Kontrargument rozważony: "bez edycji drobna pomyłka kosztuje historię — usunięcie i ponowne dodanie traci ciągłość wpisu". Rozwiązanie: edycja zostaje w MVP.
- FR-004: User can usunąć subskrypcję. Priority: must-have
  > Socrates: Kontrargument rozważony: "bez usuwania lista traci wartość — nieaktualne wpisy ją zaśmiecają". Rozwiązanie: usuwanie zostaje w MVP.
- FR-005: Admin can dodawać pozycje do wspólnego katalogu subskrypcji i przypisywać im kategorie. Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "to nice-to-have poza głównym przepływem, może poczekać bez szkody dla MVP". Rozwiązanie: zostaje nice-to-have. Zakres roli doprecyzowany po rozstrzygnięciu Open Question #2 — admin kuratoruje katalog usług, nie ogląda cudzych danych finansowych.

### Wydatki i rekomendacje
- FR-006: User can zobaczyć podsumowanie wydatków (suma miesięczna i roczna). Priority: must-have
  > Socrates: Kontrargument rozważony: ryzyko mylącego podsumowania bez normalizacji cykli. Rozwiązanie: FR zostaje must-have — to główna wartość dla użytkownika; normalizacja cykli do wspólnej jednostki to wymóg implementacyjny, nie powód do usunięcia FR.
- FR-007: User can zobaczyć rekomendacje co wyłączyć lub zamienić na tańsze, gdy więcej niż jedna subskrypcja ma tę samą kategorię. Priority: must-have
  > Socrates: Kontrargument rozważony: bez jasnej reguły FR ryzykuje być pustym TODO. Rozwiązanie: FR zostaje must-have — to jedyny element odróżniający produkt od arkusza kalkulacyjnego; konkretna reguła ustalona w fazie Business Logic (dopasowanie po kategorii wybranej ręcznie przez usera).
- FR-008: Apka automatycznie kategoryzuje subskrypcje przy użyciu AI (zamiast ręcznego wyboru kategorii). Priority: nice-to-have
- FR-009: Apka automatycznie pobiera informacje o zawartości planu ze strony dostawcy subskrypcji. Priority: nice-to-have

## User Stories

### US-01: User dodaje pierwszą subskrypcję i widzi ją na liście

- **Given** zalogowany użytkownik bez żadnych zapisanych subskrypcji
- **When** doda subskrypcję podając nazwę, kwotę i cykl płatności
- **Then** subskrypcja pojawia się na liście subskrypcji użytkownika

### US-02: User widzi rekomendację oszczędności dla zduplikowanej kategorii

- **Given** zalogowany użytkownik, który ma co najmniej dwie subskrypcje w tej samej kategorii
- **When** otworzy ekran podsumowania wydatków
- **Then** widzi rekomendację wskazującą konkretną subskrypcję do wyłączenia lub zamiany, wraz z kwotą możliwej oszczędności

#### Acceptance Criteria
- Rekomendacja pojawia się wyłącznie wtedy, gdy w jednej kategorii są co najmniej dwie subskrypcje — pojedyncza subskrypcja w kategorii nigdy nie generuje rekomendacji.
- Każda rekomendacja nazywa konkretną subskrypcję, której dotyczy, a nie samą kategorię.
- Każda rekomendacja podaje kwotę możliwej oszczędności.
- Użytkownik może odrzucić rekomendację; odrzucona rekomendacja nie wraca przy kolejnych wejściach na ekran podsumowania.

## Business Logic

Aplikacja grupuje subskrypcje użytkownika po kategorii i, gdy w jednej kategorii znajdzie więcej niż jedną aktywną subskrypcję, rekomenduje redukcję kosztu — wyłączenie jednej z nich, przejście na wspólny wyższy plan, lub zamianę na tańszą alternatywę o podobnym zakresie.

Reguła konsumuje dane wskazane przez użytkownika przy dodawaniu subskrypcji: kategorię (wybraną z listy lub utworzoną przez użytkownika), kwotę i cykl płatności. Wyjściem jest rekomendacja przypisana do grupy subskrypcji o tej samej kategorii, gdy grupa liczy więcej niż jedną pozycję — treść rekomendacji to jedna z trzech opcji (wyłącz, skonsoliduj do wyższego planu, zamień na tańszą alternatywę). Użytkownik spotyka rekomendację przy ekranie podsumowania wydatków, obok grupy zduplikowanych kategorii.

Automatyczna kategoryzacja przez AI i automatyczne pobieranie informacji o zawartości planu ze strony dostawcy (opisane przez użytkownika w rozmowie) zostały świadomie zeskopowane poza MVP — patrz FR-008 i FR-009 (nice-to-have).

## Non-Functional Requirements

- Dane finansowe użytkownika (subskrypcje, kwoty) są widoczne wyłącznie dla właściciela konta — żaden inny zalogowany użytkownik nie ma do nich dostępu.
- Utrata połączenia lub błąd zapisu podczas dodawania/edycji subskrypcji nie kasuje istniejących danych użytkownika.
- User widzi potwierdzenie zapisanej akcji (dodanie/edycja/usunięcie subskrypcji) niemal natychmiast po jej wykonaniu.
- Produkt jest w pełni użyteczny na aktualnych wersjach głównych przeglądarek desktopowych i mobilnych.

## Non-Goals

- Brak integracji bankowej / automatycznego importu transakcji — wszystkie subskrypcje dodawane ręcznie przez użytkownika. Świadoma decyzja z seed idea (usuwa zależność od dostępu do API banku).
- Brak udostępniania / współdzielenia kont między znajomymi — każdy user widzi wyłącznie swoje dane w MVP.
- Brak gwarancji dostępności offline — produkt wymaga połączenia z internetem.

## Open Questions

Brak otwartych pytań — wszystkie trzy rozstrzygnięte 2026-09-19:

1. ~~Insight odróżniający produkt od wyciągu bankowego / arkusza~~ — rozstrzygnięte: wyciąg pokazuje transakcje przeszłe, produkt pokazuje przyszłe zobowiązania (różnica perspektywy czasowej). Zapisane w `## Vision & Problem Statement`.
2. ~~Zakres roli admin~~ — rozstrzygnięte: admin kuratoruje wspólny katalog subskrypcji i przypisuje im kategorie; nie ma wglądu w cudze dane finansowe. Cel katalogu: uniknąć wielokrotnego zakładania tej samej usługi przez różnych użytkowników. Zapisane w `## Access Control` i FR-005.
3. ~~Historyjka i kryteria akceptacji dla FR-007~~ — rozstrzygnięte: US-02 z czterema kryteriami akceptacji (próg ≥2 subskrypcji w kategorii, wskazanie konkretnej subskrypcji, kwota oszczędności, możliwość odrzucenia rekomendacji).

## Forward: tech-stack

- Automatyczne przypisywanie kategorii subskrypcji (FR-008) użytkownik chce oprzeć na AI — apka ma to robić "w większości sama". Mechanizm nie trafia do PRD (PRD opisuje zdolność, nie implementację); decyzję o modelu/integracji podejmuje krok wyboru stacku.
- Automatyczne pobieranie informacji o zawartości planu ze strony dostawcy (FR-009) zakłada sięganie po dane z witryn zewnętrznych — sposób pozyskania danych do rozstrzygnięcia w kroku wyboru stacku.

## Quality cross-check

Wszystkie elementy soft-gate obecne: Access Control, Business Logic (jednozdaniowa reguła), Project artifacts, Timeline-cost acknowledgment (mvp_weeks: 1), Non-Goals. Brak luk do zgłoszenia w `/10x-prd`'s Open Questions.
