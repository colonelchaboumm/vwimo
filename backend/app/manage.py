"""Administration explicite : migrations, initialisation et comptes locaux."""
import argparse
import getpass
import secrets
from datetime import date, timedelta

from argon2 import PasswordHasher
from sqlalchemy import select

from .config import Settings
from .database import connect
from .models import AutomationSettings, BuyerCriteria, Contact, Installation, Mandate, Property, User


def initialize(settings, demo=False):
    settings.validate_runtime()
    engine, sessions = connect(settings.database_url)
    with sessions() as db:
        installation = db.get(Installation, 1)
        if installation and installation.mode != settings.mode:
            raise RuntimeError("Cette base appartient à un autre mode. Utilisez une base séparée.")
        if demo and settings.mode != "demo":
            raise RuntimeError("Impossible d'insérer des données fictives dans une base réelle.")
        if not installation:
            db.add(Installation(id=1, mode=settings.mode))
            db.add(AutomationSettings(id=1))
            db.commit()
        if demo and not db.scalar(select(User.id).where(User.email == "demo@immopilot.example")):
            db.add(User(name="Camille · Démonstration", email="demo@immopilot.example", role="admin", password_hash=PasswordHasher().hash(secrets.token_urlsafe(32))))
            sellers = []
            for name, city in [("Émilie Martin", "Annecy"), ("Thomas Bernard", "Annecy-le-Vieux"), ("Sophie Laurent", "Cran-Gevrier"), ("Antoine Petit", "Sevrier"), ("Claire Moreau", "Seynod")]:
                c = Contact(name=name, kind="seller", city=city, source="Jeu de démonstration", provenance="demo", notes="Fiche fictive — aucune coordonnée réelle.")
                db.add(c)
                db.flush()
                sellers.append(c)
            for name, budget, sector in [("Julie Dubois", 450000, "Annecy, Annecy-le-Vieux"), ("Lucas et Léa Robert", 620000, "Sevrier, Saint-Jorioz"), ("Nicolas Roux", 320000, "Cran-Gevrier, Seynod")]:
                c = Contact(name=name, kind="buyer", city="Annecy", source="Jeu de démonstration", provenance="demo")
                db.add(c)
                db.flush()
                db.add(BuyerCriteria(contact_id=c.id, budget_min=250000, budget_max=budget, min_surface=60, bedrooms=2, sectors=sector))
            today = date.today()
            for i, (title, surface, rooms, price, kind, status, age) in enumerate([
                ("Appartement lumineux · Centre-ville", 74, 3, 429000, "exclusive", "active", 23),
                ("Appartement avec terrasse · Albigny", 96, 4, 615000, "exclusive", "offer", 51),
                ("Appartement traversant · Cran-Gevrier", 63, 3, 295000, "simple", "active", 66),
                ("Maison familiale · Rive ouest", 142, 6, 890000, "partner", "compromise", 93),
                ("Appartement avec balcon · Seynod", 81, 4, 369000, "exclusive", "preparation", 5),
            ]):
                p = Property(title=title, address="Adresse fictive · démonstration", city=sellers[i].city, property_type="Maison" if i == 3 else "Appartement", surface=surface, rooms=rooms, dpe=["C", "B", "D", "C", "D"][i])
                db.add(p)
                db.flush()
                db.add(Mandate(reference=f"DEMO-{i + 1:03}", property_id=p.id, seller_id=sellers[i].id, kind=kind, status=status, signed_date=today - timedelta(days=age), end_date=today + timedelta(days=90 - age), price=price, fees=price * 0.04, partner_name="Agence fictive du Lac" if kind == "partner" else "", partner_terms="Exemple fictif : partage à définir contractuellement" if kind == "partner" else "", commercialization_authorized=kind == "partner", provenance="demo"))
            db.commit()
    engine.dispose()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["init", "create-user"])
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--email")
    parser.add_argument("--name", default="Conseiller immobilier")
    parser.add_argument("--role", choices=["admin", "advisor", "reader"], default="admin")
    args = parser.parse_args()
    settings = Settings()
    if args.command == "init":
        initialize(settings, args.demo)
        print("Base initialisée. Mode :", settings.mode)
    else:
        from pydantic import TypeAdapter, EmailStr
        email = str(TypeAdapter(EmailStr).validate_python(args.email)).lower()
        password = getpass.getpass("Mot de passe (12 caractères minimum) : ")
        if len(password) < 12:
            raise ValueError("12 caractères minimum requis.")
        if password != getpass.getpass("Confirmer : "):
            raise ValueError("Les mots de passe diffèrent.")
        _, sessions = connect(settings.database_url)
        with sessions() as db:
            db.add(User(email=email, name=args.name, role=args.role, password_hash=PasswordHasher().hash(password)))
            db.commit()
        print("Compte créé.")


if __name__ == "__main__":
    main()
