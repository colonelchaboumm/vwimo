"""Rapport local : références déclarées, prix affichés et ventes distingués."""
from html import escape
from io import BytesIO
from pathlib import Path
import threading

import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

font_lock = threading.Lock()


def render_estimate(row, author):
    with font_lock:
        if "ImmoVera" not in pdfmetrics.getRegisteredFontNames():
            fonts = Path(reportlab.__file__).parent / "fonts"
            pdfmetrics.registerFont(TTFont("ImmoVera", str(fonts / "Vera.ttf")))
            pdfmetrics.registerFont(TTFont("ImmoVeraBold", str(fonts / "VeraBd.ttf")))
            pdfmetrics.registerFontFamily("ImmoVera", normal="ImmoVera", bold="ImmoVeraBold", italic="ImmoVera", boldItalic="ImmoVeraBold")
    output = BytesIO()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ImmoBody", fontName="ImmoVera", fontSize=9, leading=13, spaceAfter=6, wordWrap="CJK"))
    styles.add(ParagraphStyle(name="ImmoTitle", fontName="ImmoVeraBold", fontSize=23, leading=29, spaceAfter=16, textColor=colors.HexColor("#173658")))
    styles.add(ParagraphStyle(name="ImmoSection", fontName="ImmoVeraBold", fontSize=12, leading=17, spaceBefore=12, spaceAfter=7, keepWithNext=True))
    styles.add(ParagraphStyle(name="ImmoSmall", parent=styles["ImmoBody"], fontSize=8, leading=12))
    styles.add(ParagraphStyle(name="ImmoValue", parent=styles["ImmoBody"], fontSize=14, leading=22, alignment=TA_CENTER))
    def p(value, style="ImmoBody"):
        return Paragraph(escape(str(value)).replace("\n", "<br/>"), styles[style])
    def money(value):
        return f"{float(value):,.0f}".replace(",", " ") + " €"
    story = [p("IMMO PILOT AI", "ImmoSection"), p("Avis de valeur", "ImmoTitle"),
             p(row.title, "ImmoSection"), p(f"{row.address}\n{row.city}"),
             p(f"{row.property_type} - {row.surface} m²"),
             p(f"Préparé par {author}\nDossier {row.id} - version {row.version}", "ImmoSmall")]
    basis_labels = {"manual": "Évaluation manuelle du conseiller", "sale": "Références de ventes déclarées", "asking": "Références de prix affichés, non de ventes constatées"}
    story += [p("Fourchette proposée", "ImmoSection"), p(basis_labels[row.basis])]
    table = Table([[p("Basse"), p("Centrale"), p("Haute")],
                   [p(money(row.low_price), "ImmoValue"), p(money(row.central_price), "ImmoValue"), p(money(row.high_price), "ImmoValue")]], colWidths=[5.4*cm]*3)
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eef5ff")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12), ("TOPPADDING", (0, 0), (-1, -1), 10)]))
    story += [table, Spacer(1, 10), p(f"Valeur centrale rapportée à la surface : {money(row.central_price / row.surface)}/m².")]
    details = row.details
    labels = {"district": "Quartier", "rooms": "Pièces", "bedrooms": "Chambres", "floor": "Étage", "construction_year": "Construction",
              "carrez_surface": "Surface Carrez (m²)", "land_surface": "Terrain (m²)", "annual_charges": "Charges annuelles (€)",
              "property_tax": "Taxe foncière (€)", "dpe": "DPE", "condition": "État général", "features": "Atouts et équipements", "works": "Travaux à considérer"}
    story.append(p("Caractéristiques déclarées", "ImmoSection"))
    for key, label in labels.items():
        if details.get(key) is not None and details.get(key) != "":
            story.append(p(f"{label} : {details[key]}"))
    story.append(p("Comparables et sources", "ImmoSection"))
    if not row.comparables:
        story.append(p("Aucun comparable fourni. Les montants relèvent exclusivement de l’évaluation manuelle du conseiller."))
    for index, comp in enumerate(row.comparables, 1):
        kind = "Vente déclarée" if comp["kind"] == "sale" else "Prix affiché"
        story += [p(f"{index}. {comp['label']}", "ImmoSection"),
                  p(f"{kind} - {money(comp['price'])} - {comp['surface']} m² - {money(float(comp['price']) / float(comp['surface']))}/m²"),
                  p(f"Source : {comp['source']}\nDate observée : {comp['observed_date']}", "ImmoSmall")]
        if comp.get("url"):
            story.append(p(comp["url"], "ImmoSmall"))
        if row.basis != "manual" and comp["kind"] != row.basis:
            story.append(p("Référence d’un autre type, présentée pour information ; non utilisée par la suggestion de fourchette.", "ImmoSmall"))
    story += [p("Analyse et stratégie du conseiller", "ImmoSection"), p(row.analysis or "Analyse non renseignée."),
              p("Méthode et limites", "ImmoSection"),
              p("La fourchette finale est choisie et validée manuellement par le conseiller. Une suggestion fondée sur les comparables utilise leurs prix au m² minimum, médian et maximum, sans correction automatique de l’état, de la localisation ou de la date. Les sources sont déclarées par le conseiller et ne font pas l’objet d’une vérification automatique. Les prix affichés ne sont pas des prix de vente constatés. Cet avis de valeur ne garantit pas le prix de transaction et ne constitue pas une expertise certifiée.", "ImmoSmall")]
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("ImmoVera", 8)
        canvas.setFillColor(colors.HexColor("#6e6e73"))
        canvas.drawString(2.4*cm, 1.2*cm, "IMMO PILOT AI - Document confidentiel")
        canvas.drawRightString(18.6*cm, 1.2*cm, f"Page {doc.page}")
        canvas.restoreState()
    SimpleDocTemplate(output, pagesize=(21*cm, 29.7*cm), topMargin=1.7*cm, bottomMargin=2*cm,
                      leftMargin=2.4*cm, rightMargin=2.4*cm, title=f"Avis de valeur - {row.title}", author=author).build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
