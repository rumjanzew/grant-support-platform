import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { Box, Button, List, ListItem, Stack, Typography } from "@mui/material";
import { useState } from "react";

import { getApiErrorMessage } from "../api/errors";
import { applicationsApi } from "../api/services";
import { useNotify } from "../notifications/NotificationContext";
import type { ReviewAttachment } from "../types";
import { formatDateTime } from "../utils/date";

interface AttachmentListProps {
  applicationId: string;
  attachments: ReviewAttachment[];
  busy?: boolean;
  onDelete?: (attachment: ReviewAttachment) => void | Promise<void>;
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${Math.max(0.1, sizeBytes / 1024).toFixed(1)} КБ`;
}

function getFileType(name: string, mimeType: string) {
  const extension = name.includes(".") ? name.split(".").pop()?.toUpperCase() : "";
  return extension || mimeType;
}

export function AttachmentList({ applicationId, attachments, busy, onDelete }: AttachmentListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const notify = useNotify();

  const download = async (attachment: ReviewAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const response = await applicationsApi.downloadAttachment(applicationId, attachment.id);
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.original_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (requestError) {
      notify(getApiErrorMessage(requestError), "error");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <List disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden", backgroundColor: "background.paper" }}>
      {attachments.map((attachment) => (
        <ListItem key={attachment.id} divider sx={{ alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1.5, py: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={650} sx={{ overflowWrap: "anywhere" }}>{attachment.original_name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {getFileType(attachment.original_name, attachment.mime_type)} · {formatFileSize(attachment.size_bytes)} · {formatDateTime(attachment.uploaded_at)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            <Button size="small" startIcon={<DownloadOutlinedIcon />} disabled={downloadingId === attachment.id} onClick={() => void download(attachment)}>
              {downloadingId === attachment.id ? "Скачиваем…" : "Скачать"}
            </Button>
            {onDelete && <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} disabled={busy} onClick={() => void onDelete(attachment)}>Удалить</Button>}
          </Stack>
        </ListItem>
      ))}
    </List>
  );
}
