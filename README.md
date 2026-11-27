# 🎄 Weihnachtsmarkt-Kasse

Einfache Kassen-Web-App fürs iPad – für den privaten Weihnachtsmarkt-Stand.
Läuft komplett im Browser, funktioniert offline, alle Daten bleiben lokal auf dem Gerät.

## Funktionen

- **Kasse:** Produkte mit Optionen als große Kacheln – ein Tipp legt z. B. „Kartoffelspirale Ketchup“ in die Bestellung. Gesamtsumme immer groß sichtbar.
- **Freier Preis** (z. B. Misteln): Betrag per Ziffernblock eingeben.
- **Kassieren:** „Passend“ oder Schein antippen (10 €, 20 €, …) → Verkauf ist gebucht und das Rückgeld wird groß angezeigt. „Rückgängig“ holt die Bestellung zurück.
- **Tagesübersicht:** Umsatz, Anzahl Verkäufe, Stückzahlen je Produkt/Option, Umsatz pro Stunde, Kassensoll (inkl. Wechselgeld), einzelne Verkäufe stornieren, CSV-Export.
- **Produkte:** Anlegen, umbenennen, Preise/Optionen ändern, sortieren, löschen. Optionen können einen eigenen Preis haben (leer = Grundpreis).
- **Backup:** Produkte + Verkäufe als JSON sichern/laden (z. B. vor dem Löschen der Browserdaten).

## Als GitHub Page veröffentlichen

1. Branch nach `main` mergen.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, Ordner `/ (root)` → Save.
3. Nach ~1 Minute ist die App unter `https://<user>.github.io/kasse/` erreichbar.

## Auf dem iPad installieren

1. Seite in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. Die App startet dann im Vollbild und funktioniert auch ohne Internet.

> Wichtig: Daten liegen im Speicher der installierten App. Am Ende des Markttags am besten
> „Backup speichern“ bzw. „CSV exportieren“ antippen.

## Lokal testen

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```
