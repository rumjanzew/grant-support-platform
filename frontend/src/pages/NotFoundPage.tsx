import { Button, Stack, TextField } from "@mui/material";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ErrorStatePage } from "../components/ErrorStatePage";

export function NotFoundPage() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) {
      navigate("/grants");
      return;
    }

    const params = new URLSearchParams();
    params.set("search", query);
    navigate(`/grants?${params.toString()}`);
  };

  return (
    <ErrorStatePage code="404" title="Страница не найдена" description="Возможно, адрес изменился или страница была удалена.">
      <Stack
        component="form"
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        onSubmit={handleSubmit}
        sx={{ width: "100%", maxWidth: 480, pt: 1 }}
      >
        <TextField
          fullWidth
          size="small"
          label="Поиск по грантам"
          placeholder="Найти грант"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" variant="contained" sx={{ flexShrink: 0 }}>
          Найти
        </Button>
      </Stack>
    </ErrorStatePage>
  );
}
