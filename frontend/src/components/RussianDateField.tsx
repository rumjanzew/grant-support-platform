import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, Button, ButtonBase, IconButton, Popover, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { formatDate, parseDate, toIsoDate } from "../utils/date";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

interface RussianDateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: React.ReactNode;
  required?: boolean;
  size?: "small" | "medium";
}

export function RussianDateField({ label, value, onChange, error, helperText, required, size = "medium" }: RussianDateFieldProps) {
  const selected = parseDate(value);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [viewDate, setViewDate] = useState(selected ?? new Date());

  useEffect(() => {
    if (selected) setViewDate(selected);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: totalDays }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [viewDate]);

  const moveMonth = (offset: number) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };
  const selectDate = (date: Date) => {
    onChange(toIsoDate(date));
    setAnchorEl(null);
  };
  const monthLabel = monthFormatter.format(viewDate);

  return (
    <>
      <TextField
        fullWidth
        required={required}
        size={size}
        label={label}
        value={selected ? formatDate(value) : ""}
        placeholder="ДД.ММ.ГГГГ"
        error={error}
        helperText={helperText}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        slotProps={{
          input: {
            readOnly: true,
            endAdornment: <IconButton size="small" aria-label={`Открыть календарь: ${label}`}><CalendarMonthOutlinedIcon fontSize="small" /></IconButton>,
          },
          htmlInput: { "aria-label": label },
        }}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 0.75, p: 2, width: 304, maxWidth: "calc(100vw - 24px)" } } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <IconButton size="small" aria-label="Предыдущий месяц" onClick={() => moveMonth(-1)}><ChevronLeftIcon /></IconButton>
          <Typography fontWeight={750} sx={{ textTransform: "capitalize" }}>{monthLabel}</Typography>
          <IconButton size="small" aria-label="Следующий месяц" onClick={() => moveMonth(1)}><ChevronRightIcon /></IconButton>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
          {weekdays.map((weekday) => <Typography key={weekday} variant="caption" color="text.secondary" textAlign="center" fontWeight={700}>{weekday}</Typography>)}
          {days.map((date, index) => date ? (
            <ButtonBase
              key={date.toISOString()}
              aria-label={formatDate(toIsoDate(date))}
              onClick={() => selectDate(date)}
              sx={{ width: 34, height: 34, mx: "auto", borderRadius: "50%", fontSize: "0.875rem", color: value === toIsoDate(date) ? "primary.contrastText" : "text.primary", backgroundColor: value === toIsoDate(date) ? "primary.main" : "transparent", "&:hover": { backgroundColor: value === toIsoDate(date) ? "primary.dark" : "primary.light" } }}
            >
              {date.getDate()}
            </ButtonBase>
          ) : <Box key={`empty-${index}`} />)}
        </Box>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <Button size="small" onClick={() => { onChange(""); setAnchorEl(null); }}>Очистить</Button>
          <Button size="small" onClick={() => selectDate(new Date())}>Сегодня</Button>
        </Stack>
      </Popover>
    </>
  );
}
