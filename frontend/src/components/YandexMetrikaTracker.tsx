import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { trackYandexMetrikaPageView } from "../analytics/yandexMetrika";

export function YandexMetrikaTracker() {
  const location = useLocation();

  useEffect(() => {
    trackYandexMetrikaPageView();
  }, [location.hash, location.pathname, location.search]);

  return null;
}

