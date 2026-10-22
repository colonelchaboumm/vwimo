import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Map as LibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { money } from "../../lib/utils";
import { Field, ResourceState, useResource } from "../commercial/shared";
import { Button } from "../ui/button";
import type { Listing } from "./types";

function PointsMap({ items, basemap }: { items: Listing[]; basemap: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let instance: LibreMap | undefined;
    setError("");
    setReady(false);
    void import("maplibre-gl")
      .then((lib) => {
        if (cancelled || !container.current) return;
        try {
          lib.setWorkerUrl(mapWorkerUrl);
          instance = new lib.Map({
            attributionControl: { compact: false },
            container: container.current,
            center: [Number(items[0].longitude), Number(items[0].latitude)],
            zoom: 11,
            maxZoom: 18,
            style: {
              version: 8,
              sources: basemap
                ? {
                    osm: {
                      type: "raster",
                      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                      tileSize: 256,
                      maxzoom: 19,
                      attribution:
                        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
                    },
                  }
                : {},
              layers: basemap
                ? [{ id: "osm", type: "raster", source: "osm" }]
                : [
                    {
                      id: "local-background",
                      type: "background",
                      paint: { "background-color": "#e9eff4" },
                    },
                  ],
            },
          });
          instance.on("error", () => {
            if (!cancelled)
              setError(
                "Le fond cartographique ou le rendu est indisponible. Les coordonnées restent consultables dans la liste.",
              );
          });
          instance.on("load", () => {
            if (!cancelled) setReady(true);
          });
          instance.addControl(new lib.NavigationControl(), "top-right");
          const bounds = new lib.LngLatBounds();
          for (const item of items) {
            const point: [number, number] = [
              Number(item.longitude),
              Number(item.latitude),
            ];
            bounds.extend(point);
            const element = document.createElement("button");
            element.type = "button";
            element.className = "radar-map-marker";
            element.textContent = "●";
            element.setAttribute(
              "aria-label",
              "Annonce : " + item.title + " · " + item.city,
            );
            new lib.Marker({ element })
              .setLngLat(point)
              .setPopup(
                new lib.Popup({ offset: 15 }).setText(
                  `${item.title} · ${item.city} · ${money(item.price)} · Coordonnées déclarées`,
                ),
              )
              .addTo(instance);
          }
          if (items.length > 1)
            instance.fitBounds(bounds, {
              padding: 65,
              maxZoom: 14,
              duration: 0,
            });
        } catch {
          if (!cancelled)
            setError(
              "La carte nécessite WebGL. Utilisez la liste de coordonnées ci-dessous sur cet appareil.",
            );
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Le module cartographique n’a pas pu être chargé. La liste reste disponible.",
          );
      });
    return () => {
      cancelled = true;
      instance?.remove();
    };
  }, [items, basemap]);
  return (
    <>
      {error ? (
        <div className="notice" role="status">
          {error}
        </div>
      ) : (
        <p className="commercial-status" role="status">
          {ready
            ? "Carte affichée · coordonnées déclarées"
            : "Chargement de la carte…"}
        </p>
      )}
      <div
        ref={container}
        className="radar-map"
        aria-label="Carte des annonces aux coordonnées déclarées"
      />
    </>
  );
}

export function PropertyMapPage() {
  const [q, setQ] = useState("");
  const [basemap, setBasemap] = useState(false);
  const resource = useResource<{
    items: Listing[];
    total: number;
    missing_coordinates: number;
    limited: boolean;
  }>("/radar/map?q=" + encodeURIComponent(q));
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">VOTRE SECTEUR, EN PERSPECTIVE</div>
          <h1>Vos pistes sur la carte.</h1>
          <p>
            Localisez les annonces actives du radar dont les coordonnées sont
            renseignées.
          </p>
        </div>
        <Button variant="outline" onClick={resource.refresh}>
          <RefreshCw size={15} /> Actualiser
        </Button>
      </div>
      <div className="commercial-filters panel">
        <Field label="Filtrer la carte">
          {(id) => (
            <input
              id={id}
              value={q}
              maxLength={120}
              placeholder="Commune, source, titre…"
              onChange={(e) => setQ(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="notice">
        Les positions sont déclarées par saisie ou CSV : aucun géocodage ni
        vérification automatique. Les mandats, estimations et transactions ne
        sont pas encore représentés sur cette carte.
      </div>
      <label className="commercial-check radar-basemap">
        <input
          type="checkbox"
          checked={basemap}
          onChange={(e) => setBasemap(e.target.checked)}
        />
        Afficher le fond OpenStreetMap (connexion internet)
      </label>
      <p className="commercial-status">
        Sans cette option, seuls vos points sont affichés sur un fond neutre,
        sans requête externe. L’activer transmet votre adresse IP et les zones
        de carte consultées à OpenStreetMap ; les titres et dossiers ne sont pas
        envoyés. Pas de téléchargement hors ligne du fond.
      </p>
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {resource.data && (
        <>
          <p className="commercial-status">
            {resource.data.total} position(s) ·{" "}
            {resource.data.missing_coordinates} annonce(s) active(s) sans
            coordonnées
            {resource.data.limited
              ? " · 1 000 points maximum affichés, affinez la recherche"
              : ""}
          </p>
          {resource.data.items.length ? (
            <PointsMap items={resource.data.items} basemap={basemap} />
          ) : (
            <div className="panel radar-empty">
              <h2>Aucune position à afficher.</h2>
              <p>
                Renseignez latitude et longitude dans les annonces du radar.
              </p>
            </div>
          )}
          <div className="commercial-grid">
            {resource.data.items.map((item) => (
              <article className="panel radar-card" key={item.id}>
                <h2>{item.title}</h2>
                <p>
                  {item.city} · {item.source_name}
                </p>
                <p>
                  Latitude {item.latitude}
                  <br />
                  Longitude {item.longitude}
                </p>
                <strong>{money(item.price)}</strong>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
