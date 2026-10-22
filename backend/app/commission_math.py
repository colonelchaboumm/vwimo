"""Calcul décimal contractuel : aucun taux fiscal ni taux de rémunération implicite."""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP


def cents(value):
    return Decimal(value).quantize(Decimal(".01"), rounding=ROUND_HALF_UP)


def period_bounds(day, period):
    start = date(day.year, day.month if period == "month" else 1, 1)
    end = date(day.year+1, 1, 1) if period == "year" or day.month == 12 else date(day.year, day.month+1, 1)
    return start, end


def calculate(tiers, method, before, base, adjustment=Decimal(0)):
    before, base, adjustment = Decimal(before), Decimal(base), Decimal(adjustment)
    after = before+base
    def rate_at(amount):
        return next(Decimal(t["rate"]) for t in reversed(tiers) if amount >= Decimal(t["threshold"]))
    segments = []
    if method == "global":
        previous = before*rate_at(before)/100
        entitlement = after*rate_at(after)/100
        raw = cents(entitlement)-cents(previous)
        detail = {"before_rate": str(rate_at(before)), "after_rate": str(rate_at(after)),
                  "entitlement_before": str(previous), "entitlement_after": str(entitlement)}
    else:
        raw = Decimal(0)
        for index, tier in enumerate(tiers):
            lower = Decimal(tier["threshold"])
            upper = Decimal(tiers[index+1]["threshold"]) if index+1 < len(tiers) else after
            portion = max(Decimal(0), min(after, upper)-max(before, lower))
            if portion:
                part = portion*Decimal(tier["rate"])/100
                segments.append({"base": str(portion), "rate": str(tier["rate"]), "commission_unrounded": str(part)})
                raw += part
        detail = {"segments": segments}
    result = cents(raw+adjustment)
    if not 0 <= result <= Decimal("999999999"):
        raise ValueError("Le résultat après ajustement doit être compris entre 0 et 999 999 999 €.")
    return {"method": method, "cumulative_before": str(before), "base": str(base), "cumulative_after": str(after),
            "unrounded": str(raw), "adjustment": str(adjustment), "amount": str(result), "rounding": "Droits cumulés arrondis au centime puis différence" if method == "global" else "Arrondi final au centime, demi supérieur", **detail}
