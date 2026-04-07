"""
BlancBleu - Test de l'API Flask
Lance d'abord : python app.py
"""
import urllib.request, json, sys

BASE = "http://localhost:5001"

def post(url, payload):
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(url, data=data,
           headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())

def test(nom, payload):
    try:
        res = post(f"{BASE}/predict", payload)
        print(f"\n{'='*50}")
        print(f"  Test : {nom}")
        print(f"{'='*50}")
        print(f"  Priorite       : {res['priorite']}")
        print(f"  Score          : {res['score']}")
        print(f"  Confiance      : {res.get('confiance','—')}%")
        print(f"  Unite rec.     : {res['uniteRecommandee']}")
        print(f"  Source         : {res['source']}")
        print(f"  Probabilites   : P1={res['probabilites'].get('P1',0)}% | P2={res['probabilites'].get('P2',0)}% | P3={res['probabilites'].get('P3',0)}%")
        for j in res.get('justification',[]):
            print(f"  > {j}")
    except Exception as e:
        print(f"\nERREUR [{nom}] : {e}")
        print("Verifie que python app.py est lance sur le port 5001")

if __name__ == "__main__":
    print("\nBlancBleu - Tests API IA de triage")

    # Verif sante
    try:
        h = json.loads(urllib.request.urlopen(f"{BASE}/health", timeout=3).read())
        print(f"\nAPI OK — Modele charge : {h['loaded']} | Precision : {h['accuracy']}%")
    except:
        print("\nERREUR : API non disponible. Lance : python app.py")
        sys.exit(1)

    test("Arret cardiaque (doit etre P1)", {
        "typeIncident":  "Arrêt cardiaque",
        "etatPatient":   "inconscient",
        "age":           67,
        "nrsPain":       8,
        "arrivalMode":   "ambulance",
        "injury":        False,
    })

    test("Accident de la route (doit etre P2)", {
        "typeIncident":  "Accident de la route",
        "etatPatient":   "conscient",
        "age":           35,
        "nrsPain":       6,
        "arrivalMode":   "ambulance",
        "injury":        True,
    })

    test("Malaise simple (doit etre P3)", {
        "typeIncident":  "Malaise",
        "etatPatient":   "stable",
        "age":           45,
        "nrsPain":       2,
        "arrivalMode":   "walk",
        "injury":        False,
    })

    print(f"\nTests termines !")