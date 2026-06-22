// DeviceInfo groups editable device identity and network fields for a repair/testing record.
import {
  Box,
  Divider,
  MenuItem,
  TextField,
  Typography,
  Stack
} from "@mui/material";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";

const textFieldProps = {
  // Shared TextField settings keep all device fields visually consistent.
  fullWidth: true,
  variant: "outlined",
  size: "small",
  slotProps: {
    inputLabel: {
      shrink: true,
    },
  },
};

export default function DeviceInfo({ clients = [], deviceInfo, onChange, onClientChange }) {
  const updateField = (field) => (event) => {
    // Send field changes back to the parent page where the full report state lives.
    onChange(field, event.target.value);
  };

  return (
    <Stack spacing={2.25}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "#e8f2ff",
            borderRadius: 1.5,
            color: "#1f5f99",
            display: "flex",
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <DevicesRoundedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            Device Information
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Client and Biometric Device Information.
          </Typography>
        </Box>
      </Stack>

      <Divider />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr" },
        }}
      >
        <TextField
          label="CST Number"
          placeholder="CST-00000"
          value={deviceInfo.cstNumber}
          onChange={updateField("cstNumber")}
          {...textFieldProps}
        />

        <TextField
          label="Client Name"
          value={deviceInfo.clientId || ""}
          onChange={(event) => {
            // Find the selected client so the parent can also populate the client code.
            const selectedClient = clients.find((client) => String(client.id) === String(event.target.value));
            onClientChange?.(selectedClient || null);
          }}
          select
          {...textFieldProps}
        >
          <MenuItem value="">Select Client</MenuItem>
          {clients.map((client) => (
            <MenuItem key={client.id} value={client.id}>
              {client.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Client Code"
          value={deviceInfo.clientCode || ""}
          InputProps={{ readOnly: true }}
          {...textFieldProps}
        />

        <TextField
          label="Arrival Date"
          type="date"
          value={deviceInfo.arrivalDate}
          onChange={updateField("arrivalDate")}
          {...textFieldProps}
        />

        <TextField
          label="Device Serial Number"
          placeholder="Serial number"
          value={deviceInfo.deviceSerialNumber}
          onChange={updateField("deviceSerialNumber")}
          {...textFieldProps}
        />

        <TextField
          label="Device Type"
          placeholder="Device Model"
          value={deviceInfo.deviceType}
          onChange={updateField("deviceType")}
          {...textFieldProps}
        />

        <TextField
          label="Algorithm"
          placeholder="Algorithm Version"
          value={deviceInfo.algorithm}
          onChange={updateField("algorithm")}
          {...textFieldProps}
        />

        <TextField
          label="Pin Width"
          placeholder="Current Width"
          value={deviceInfo.pinWidth}
          onChange={updateField("pinWidth")}
          {...textFieldProps}
        />

        <TextField
          label="Previous Pin Width"
          placeholder="Previous Width"
          value={deviceInfo.previousPinWidth}
          onChange={updateField("previousPinWidth")}
          {...textFieldProps}
        />
      </Box>

      <TextField
        label="Remarks"
        multiline
        rows={4}
        placeholder=""
        value={deviceInfo.remarks}
        onChange={updateField("remarks")}
        {...textFieldProps}
      />
    </Stack>
  );
}
