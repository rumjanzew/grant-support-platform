import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Box, Button, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

const steps = [
  ["1", "Найдите грант", "Используйте поиск и фильтры по категории и срокам."],
  ["2", "Подготовьте заявку", "Сохраните черновик и приложите документы."],
  ["3", "Отправьте на рассмотрение", "Отслеживайте актуальный статус в личном кабинете."],
];

export function HomePage() {
  const { user } = useAuth();
  return (
    <Stack spacing={{ xs: 5, md: 8 }}>
      <Box sx={{ borderRadius: 4, p: { xs: 3, sm: 5, md: 7 }, color: "text.primary", backgroundColor: "background.paper", border: 1, borderColor: "divider", boxShadow: "0 5px 22px rgba(32, 32, 51, 0.055)", overflow: "hidden" }}>
        <Typography variant="overline" color="primary.main">Республика Коми</Typography>
        <Typography variant="h2" component="h1" sx={{ maxWidth: 760, mt: 1, fontSize: { xs: "2.1rem", sm: "3rem", md: "3.75rem" } }}>
          Поддержка идей, которые развивают регион
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 680, mt: 2, fontWeight: 400 }}>
          Находите подходящие гранты, готовьте документы и следите за заявкой в одном месте.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 4 }}>
          <Button component={RouterLink} to="/grants" variant="contained" endIcon={<ArrowForwardIcon />}>Смотреть гранты</Button>
          {!user && <Button component={RouterLink} to="/register" variant="outlined">Создать аккаунт</Button>}
          {user?.role === "Applicant" && <Button component={RouterLink} to="/applications" variant="outlined">Мои заявки</Button>}
        </Stack>
      </Box>
      <Box>
        <Typography variant="h4" component="h2" sx={{ mb: 3 }}>Как подать заявку</Typography>
        <Grid container spacing={2}>
          {steps.map(([number, title, description]) => (
            <Grid key={number} size={{ xs: 12, md: 4 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h4" color="primary" fontWeight={800}>{number}</Typography>
                  <Typography variant="h6" sx={{ mt: 1 }}>{title}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>{description}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Stack>
  );
}
