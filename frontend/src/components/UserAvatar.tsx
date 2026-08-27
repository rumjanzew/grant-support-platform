import { Avatar } from "@mui/material";

interface UserAvatarProps {
  user: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
  size?: number;
}

export function getUserInitials(user: UserAvatarProps["user"]) {
  const firstName = user.first_name?.trim();
  const lastName = user.last_name?.trim();
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("");
  return (initials || user.email.trim()[0] || "П").toLocaleUpperCase("ru-RU");
}

export function UserAvatar({ user, size = 32 }: UserAvatarProps) {
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: "primary.main", color: "primary.contrastText", fontSize: size * 0.4, fontWeight: 750 }}>
      {getUserInitials(user)}
    </Avatar>
  );
}
