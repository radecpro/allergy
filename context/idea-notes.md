# Nazwa robocza

Allergen Finder

# Cel produktu

Pomoc użytkownikom z alergiami sezonowymi w identyfikacji potencjalnych alergenów odpowiedzialnych za występujące objawy na podstawie lokalizacji, aktualnych danych środowiskowych oraz zgłoszonych symptomów.

# Problem

Osoby cierpiące na alergie sezonowe często nie wiedzą, które alergeny są odpowiedzialne za ich aktualne objawy. Informacje o pyleniu są rozproszone pomiędzy wieloma serwisami i wymagają samodzielnej interpretacji.

# Grupa docelowa

Osoby w wieku 18-55 lat cierpiące na sezonowe alergie wziewne związane z pyłkami drzew, traw, chwastów oraz zarodnikami pleśni.

# MVP - funkcjonalności podstawowe

## 1. Wprowadzenie lokalizacji

Użytkownik może:

- udostępnić lokalizację urządzenia,
- wyszukać i wybrać miasto ręcznie.

## 2. Wprowadzenie objawów

Użytkownik wybiera występujące objawy z listy:

- kichanie,
- katar,
- zatkany nos,
- swędzenie nosa,
- swędzenie oczu,
- łzawienie oczu,
- kaszel,
- duszność.

Dodatkowo określa intensywność objawów w skali 1-5.

## 3. Analiza potencjalnych alergenów

System analizuje:

- lokalizację użytkownika,
- aktualne dane dotyczące pylenia,
- zgłoszone objawy.

Wynikiem jest lista potencjalnych alergenów uporządkowanych według prawdopodobieństwa wystąpienia.

## 4. Prezentacja wyników

Dla każdego alergenu prezentowane są:

- nazwa alergenu,
- poziom prawdopodobieństwa (bardzo wysokie, wysokie, średnie, niskie),
- aktualna aktywność pylenia,
- krótkie uzasadnienie wyniku.

# Funkcjonalności dodatkowe

## Historia objawów

Użytkownik może zapisywać dzienne wpisy zawierające:

- objawy,
- intensywność,
- lokalizację,
- datę.

## Alert wysokiego pylenia

System może wysyłać powiadomienia o przewidywanym wysokim poziomie pylenia wybranych alergenów.

## Profil alergiczny użytkownika

Na podstawie historii zgłoszeń system buduje ranking alergenów najczęściej związanych z występowaniem objawów użytkownika.

# Zakres wyłączony z MVP

- diagnostyka medyczna,
- rekomendacje leków,
- chatbot medyczny,
- analiza zdjęć,
- integracje z urządzeniami zdrowotnymi,
- konta rodzinne,
- długoterminowe prognozy zdrowotne.

# Kluczowa metryka sukcesu

Użytkownik jest w stanie w mniej niż 30 sekund od wejścia do aplikacji uzyskać listę najbardziej prawdopodobnych alergenów odpowiedzialnych za swoje aktualne objawy.