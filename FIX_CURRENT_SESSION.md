# FIX: Gjenopprett "current" session dokument

## Manuelt i Firebase Console (2 minutter):

1. Gå til: https://console.firebase.google.com/project/badminton-b95ac/firestore/data

2. Velg collection: **sessions**

3. Klikk: **Add document**

4. Document ID: **current** (VIKTIG: må være nøyaktig "current")

5. Legg til fields (basert på skjermbildet ditt):
   ```
   date: "26/01/2026"  (string)
   day: "Monday"  (string)
   startTime: "10:00"  (string)
   endTime: "12:00"  (string)
   maxPlayers: 12  (number)
   published: true  (boolean)
   closed: false  (boolean)
   maintenanceMode: false  (boolean)
   ```

6. Klikk **Save**

7. Gå tilbake til lineapp admin → refresh siden

8. Nå skal det fungere!

---

## ELLER: Via script (hvis du foretrekker):

Se nedenfor...
